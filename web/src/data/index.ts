import type { Repository } from './repository';
import { createLocalRepository } from './local/localRepository';
import { createHttpRepository } from './http/httpRepository';

/**
 * Фабрика репозитория (PLAN.md §2).
 * Фазы 0–6: localStorage. Фаза 7: HTTP при VITE_USE_API=true.
 */
const useApi = import.meta.env.VITE_USE_API === 'true';

export const isApiMode = useApi;

export const repo: Repository = useApi ? createHttpRepository() : createLocalRepository();
