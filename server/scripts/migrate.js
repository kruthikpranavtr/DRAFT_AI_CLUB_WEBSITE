import 'dotenv/config';
import { db,migrationReport } from '../db.js';

console.log(JSON.stringify(migrationReport,null,2));
db.close();
