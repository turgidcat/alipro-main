const axios = require('axios');
(async () => {
  const resp = await axios.post('http://127.0.0.1:3000/api/books/35a0348b-505e-45ce-bf96-35df6d73ed21/chapter-plans/5', {
    appearing_roles: ['程婉儿', '林逸'],
    role_execution: [
      { role: '程婉儿', personality: '机敏果敢', background: '程咬金之女，女扮男装查案', appearance: '眉眼英气' },
      { role: '林逸', personality: '冷静理性', background: '穿越者，县衙账房', appearance: '眉骨高，眼神审视' }
    ]
  }, { timeout: 60000 });
  console.log('save success:', resp.data?.success, '| role_execution:', resp.data?.data?.structured_content?.role_execution?.length);
  console.log('appearing_roles:', resp.data?.data?.appearing_roles);
})();
