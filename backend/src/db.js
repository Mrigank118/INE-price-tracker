import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from './config.js';

export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  {
    realtime: {
      transport: ws
    }
  }
);