import axios from 'axios';
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/generate', {
      prompt: "test"
    });
    console.log(res.data);
  } catch (e) {
    if (e.response) {
      console.log(e.response.status, (typeof e.response.data === 'string' ? e.response.data.substring(0, 100) : e.response.data));
    } else {
      console.log(e.message);
    }
  }
}
test();
