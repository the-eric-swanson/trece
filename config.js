// config.js
const CONFIG = {
    SUPABASE_URL: 'https://ngaghclerugrfppmqujy.supabase.co',
    SUPABASE_KEY: 'sb_publishable_WN-KWNCicdm8IHVUTSlWeA_2tKSbc1d',

    // Session State
    SESSION_ID: crypto.randomUUID(),
    PLAYER_INITIALS: "", // We will store this once they enter it
    PEAK_SCORE: 0,

    // Flags
    HAS_PROMPTED: false,
    GAME_MODE: 'rated' // 'rated' or 'casual'
};