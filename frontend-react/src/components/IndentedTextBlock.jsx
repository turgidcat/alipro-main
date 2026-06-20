function splitParagraphs(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function IndentedTextBlock({
  text,
  className = '',
  paragraphClassName = ''
}) {
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) return null;

  return (
    <div className={['cn-text-block', className].filter(Boolean).join(' ')}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`} className={paragraphClassName}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}
