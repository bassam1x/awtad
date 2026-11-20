import { createApp } from './app.js';
import { config } from './config.js';
import { seedIfEmpty } from './seed.js';

seedIfEmpty();
createApp().listen(config.port, () => console.log(`أوتاد API تعمل على http://localhost:${config.port}`));
