import db from './db.js';
import { createApp } from './createApp.js';

const PORT = 3001;

const app = createApp({ db });

app.listen(PORT, () => {
  console.log(`Focus Flow API listening on http://localhost:${PORT}`);
});
