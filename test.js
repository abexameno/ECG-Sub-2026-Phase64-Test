const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/illustrations/generate', {
      prompt: "test", subject: "Math", topic: "Algebra", grade: "10"
    });
    console.log(res.data);
  } catch (e) {
    if (e.response) {
      console.log(e.response.status, e.response.data);
    } else {
      console.log(e.message);
    }
  }
}
test();
