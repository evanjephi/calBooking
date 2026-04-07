require('dotenv').config();
const axios = require('axios');

async function testEndpoints() {
  const agentId = 'agent_64242c5ed7ba7a5a894545edc9';
  const apiKey = process.env.RETELL_API_KEY;
  
  const endpoints = [
    { method: 'GET', path: '/v2/agents', desc: 'List agents v2' },
    { method: 'GET', path: `/v2/agents/${agentId}`, desc: 'Get agent v2' },
    { method: 'GET', path: `/v1/agents/${agentId}`, desc: 'Get agent v1' },
    { method: 'GET', path: `/agents/${agentId}`, desc: 'Get agent no version' },
  ];

  for (const ep of endpoints) {
    try {
      const response = await axios.get(
        `https://api.retellai.com${ep.path}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 3000 }
      );
      console.log('success ' + ep.desc + ' (200)');
    } catch (e) {
      console.log('fail ' + ep.desc + ' (' + (e.response?.status || e.code) + ')');
    }
  }
}

testEndpoints();
