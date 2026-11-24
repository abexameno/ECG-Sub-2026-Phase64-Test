import axios from 'axios';
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/illustrations/generate', {
      prompt: "test", subject: "Math", topic: "Algebra", grade: "10"
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
