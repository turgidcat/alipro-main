"""
Longform Studio Edge TTS 助手。

用法：
  python edge-tts-helper.py voices
      输出可用音色 JSON（stdout，UTF-8）。
  python edge-tts-helper.py synthesize <输出文件>
      从 stdin 读取 JSON：
      {
        "text": "...",
        "voice": "...",
        "rate": "+0%",
        "volume": "+0%",
        "pitch": "+0Hz",
        "outputFormat": "audio-24khz-48kbitrate-mono-mp3"  # 可选
      }
      将合成的音频写入 <输出文件>。
"""

import asyncio
import json
import re
import sys
import time
from xml.sax.saxutils import escape

import aiohttp
import edge_tts
from edge_tts.communicate import (
    _SSL_CTX,
    connect_id,
    date_to_string,
    get_headers_and_data,
    remove_incompatible_characters,
    ssml_headers_plus_data,
)
from edge_tts.constants import SEC_MS_GEC_VERSION, WSS_HEADERS, WSS_URL
from edge_tts.data_classes import TTSConfig
from edge_tts.drm import DRM
from edge_tts.exceptions import NoAudioReceived


for stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
# 免费 Edge 端点实测可用的高质量输出格式（48k 为默认）。
SUPPORTED_OUTPUT_FORMATS = {
    "audio-24khz-48kbitrate-mono-mp3",
    "audio-24khz-96kbitrate-mono-mp3",
}


def run(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def build_ssml(payload):
    """构造与 edge-tts 默认一致的 SSML（含语速/音量/音调 prosody）。"""
    tc = TTSConfig(
        payload["voice"],
        payload.get("rate", "+0%"),
        payload.get("volume", "+0%"),
        payload.get("pitch", "+0Hz"),
        "SentenceBoundary",
    )
    escaped_text = escape(remove_incompatible_characters(payload["text"]))
    return (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
        f"<voice name='{tc.voice}'>"
        f"<prosody pitch='{tc.pitch}' rate='{tc.rate}' volume='{tc.volume}'>"
        f"{escaped_text}"
        "</prosody>"
        "</voice>"
        "</speak>"
    )


async def stream_audio_to_file(payload, output):
    """通过原始 WebSocket 合成，用于切换输出格式（如 96kbps MP3）。

    说明：edge-tts 7.2.8 的 Communicate 把输出格式写死为 48kbps，
    因此这里复用其内部协议与 DRM 处理，仅把 speech.config 的
    outputFormat 替换成目标格式。文本由 Node 侧按句分片（<=1200 字），
    单次连接只处理一片文本，无需跨分片偏移补偿。
    """
    ssml = build_ssml(payload)
    output_format = payload.get("outputFormat") or DEFAULT_OUTPUT_FORMAT

    async def connect_and_stream():
        audio_chunks = []
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.ws_connect(
                f"{WSS_URL}&ConnectionId={connect_id()}"
                f"&Sec-MS-GEC={DRM.generate_sec_ms_gec()}"
                f"&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}",
                compress=15,
                headers=DRM.headers_with_muid(WSS_HEADERS),
                ssl=_SSL_CTX,
            ) as websocket:
                await websocket.send_str(
                    f"X-Timestamp:{date_to_string()}\r\n"
                    "Content-Type:application/json; charset=utf-8\r\n"
                    "Path:speech.config\r\n\r\n"
                    '{"context":{"synthesis":{"audio":{"metadataoptions":{'
                    '"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"'
                    f'}},"outputFormat":"{output_format}"'
                    "}}}}\r\n"
                )
                await websocket.send_str(
                    ssml_headers_plus_data(connect_id(), date_to_string(), ssml)
                )

                async for received in websocket:
                    if received.type == aiohttp.WSMsgType.TEXT:
                        raw = received.data.encode("utf-8")
                        parameters, _ = get_headers_and_data(
                            raw, raw.find(b"\r\n\r\n")
                        )
                        if parameters.get(b"Path") == b"turn.end":
                            break
                    elif received.type == aiohttp.WSMsgType.BINARY:
                        if len(received.data) < 2:
                            continue
                        header_length = int.from_bytes(received.data[:2], "big")
                        if header_length > len(received.data):
                            continue
                        parameters, data = get_headers_and_data(
                            received.data, header_length
                        )
                        if parameters.get(b"Path") == b"audio" and data:
                            audio_chunks.append(data)
                    elif received.type == aiohttp.WSMsgType.ERROR:
                        raise RuntimeError(
                            str(received.data or "Edge TTS WebSocket 错误")
                        )

        if not audio_chunks:
            raise NoAudioReceived("No audio was received from the service.")
        with open(output, "wb") as audio_file:
            audio_file.write(b"".join(audio_chunks))

    try:
        await connect_and_stream()
    except aiohttp.ClientResponseError as error:
        if error.status != 403:
            raise
        # Edge 偶发要求刷新 DRM 令牌后重连一次。
        DRM.handle_client_response_error(error)
        await connect_and_stream()


def synthesize_with_retry(payload, output, max_attempts=3):
    """合成单片文本；NoAudioReceived（服务限流/偶发失败）时重试。"""
    output_format = payload.get("outputFormat") or DEFAULT_OUTPUT_FORMAT
    if output_format not in SUPPORTED_OUTPUT_FORMATS:
        raise ValueError(f"不支持的输出格式：{output_format}")

    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            if output_format == DEFAULT_OUTPUT_FORMAT:
                communicate = edge_tts.Communicate(
                    payload["text"],
                    payload["voice"],
                    rate=payload.get("rate", "+0%"),
                    volume=payload.get("volume", "+0%"),
                    pitch=payload.get("pitch", "+0Hz"),
                )
                run(communicate.save(output))
            else:
                run(stream_audio_to_file(payload, output))
            return
        except (NoAudioReceived, RuntimeError) as error:
            last_error = error
            if attempt < max_attempts:
                time.sleep(2 * attempt)
    raise last_error


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else ""

    if command == "voices":
        voices = run(edge_tts.list_voices())
        json.dump(voices, sys.stdout, ensure_ascii=False)
        return

    if command == "synthesize":
        output = sys.argv[2]
        payload = json.load(sys.stdin)
        synthesize_with_retry(payload, output)
        return

    print(f"unknown command: {command}", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
