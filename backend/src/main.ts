import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  return res.status(200).send({ ok: true });
});

app.listen(4000, () => console.log('Server started on port 4000'));
