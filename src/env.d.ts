/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_VAPID_PUBLIC_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			readonly DATABASE_URL: string;
			readonly SESSION_PASSWORD: string;
			readonly VAPID_PRIVATE_KEY: string;
			readonly MYTT_CLUBNR: string;
			readonly MYTT_FEDNICKNAME: string;
			readonly MYTT_BASE_URL: string;
			readonly API_AUTH_TOKEN: string;
		}
	}
}

export {};
