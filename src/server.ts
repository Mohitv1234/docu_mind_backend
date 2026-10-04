import { app } from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';

async function bootstrap() {
  await connectDatabase();
  app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
}
bootstrap().catch((error) => { console.error('Failed to start API:', error); process.exit(1); });
