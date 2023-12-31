const FormData = require('form-data');
import { withFileUpload } from 'next-multiparty';
import { createReadStream } from 'fs';

export default withFileUpload(async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).send('No file uploaded');
    return;
  }

  const formData = new FormData();
  formData.append('file', createReadStream(file.filepath), 'audio.webm');
  formData.append('model', 'whisper-1');
  const response = await fetch('https://api.openai-proxy.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const { text, error } = await response.json();
  if (response.ok) {
    res.status(200).json({ text: text });
  } else {
    console.log('OPEN AI ERROR:');
    console.log(error.message);
    res.status(400).send(new Error());
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};
