import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://tyfqmonxfsiejdzepkua.supabase.co';
const supabaseAnonKey = 'sb_publishable_5Ns0FN8J9eC_NDUjdolE2Q_RWVQV89Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
