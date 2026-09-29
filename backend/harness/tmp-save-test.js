const axios = require('axios');
(async () => {
  const marker = '【SAVE-TEST-MARKER】' + Date.now();
  const resp = await axios.post('http://127.0.0.1:3000/api/books/35a0348b-505e-45ce-bf96-35df6d73ed21/chapters/upsert', {
    title: '第 5 章 密信疑云',
    chapterName: '密信疑云',
    chapterNumber: 5,
    content: marker
  }, { timeout: 60000 });
  console.log('save response success:', resp.data?.success, '| content_len:', resp.data?.data?.content?.length);
  console.log('marker:', marker);
})();
