import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { router } from './routes';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.use('/', router);

app.listen(port, () => {
  console.log(`Microservice listening at http://localhost:${port}`);
});
