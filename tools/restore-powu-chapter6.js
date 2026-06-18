const BOOK_ID = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';

const chapter6Content = [
  '夜色压下来后，宗门外站比白日安静得过分。沈破雾换了身不显眼的深衣，胸口的闷痛还没有彻底散去，可一想到那页被抽走的旧约残卷，他反而比前几日更稳。既然已经知道答案就在禁区里，继续躲着只会让别人先一步把门关死。',
  '陆听澜没有和他争论要不要去，只在翻过回廊时替他挡开了一队夜巡。她压低声音提醒，禁区里封的从来不只是旧纸旧案，还有宗门最不愿被外人知道的失控记录。沈破雾点了点头，腕上的雾纹却在靠近石库时自行发热，像是那里面真的有什么东西在隔着墙认他。',
  '两人潜进封档石室，最里面一格木匣果然少了一页整齐裁断的卷纸。沈破雾把夹在匣底的残页抽出来，只看了第一眼，呼吸就顿了一瞬。残页上写着“归门血钥”四字，后面紧跟着的批注说得更狠：此印若寄于活人，既可引门，亦可反噬其主。',
  '字迹映进眼里的同时，他左腕的雾纹忽然像被火擦过，疼得他几乎握不住纸。陆听澜一把按住他，才没让木匣摔在地上。那一刻沈破雾反而彻底明白了，自己和这桩旧案根本不是被动牵连，而是从一开始就被写在钥匙的位置上。',
  '他们离开禁区时没有惊动明面上的守卫，可回到长廊尽头，白照夜已经站在风灯下，像是早就算准了他们会从哪条路回来。他没有追问残页内容，只看了沈破雾一眼，淡淡说了一句“看来门已经认人了”。夜风从廊外卷进来，沈破雾把残页按进袖中，忽然意识到自己虽然抢到了线索，却也从今晚开始，真正被宗门更高处的人记住了。'
].join('\n\n');

async function main() {
  const response = await fetch(`http://localhost:3000/api/books/${BOOK_ID}/chapters/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      title: '第 6 章 禁区残页',
      chapterName: '禁区残页',
      chapterNumber: 6,
      content: chapter6Content
    })
  });

  const text = await response.text();
  console.log(response.status);
  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
