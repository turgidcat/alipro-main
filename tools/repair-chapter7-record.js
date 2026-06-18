const { ChapterService } = require('../backend/services/database');

async function main() {
  const service = new ChapterService();
  const bookId = 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
  const chapterNumber = 7;

  const result = await service.upsertByChapterNumber(
    bookId,
    chapterNumber,
    {
      title: '第 7 章 风灯试探',
      chapter_name: '风灯试探'
    },
    ''
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
