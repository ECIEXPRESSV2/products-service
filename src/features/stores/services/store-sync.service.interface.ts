export const STORE_SYNC_SERVICE = Symbol('STORE_SYNC_SERVICE');

export interface IStoreSyncService {
  /**
   * Reconcilia la réplica local de una tienda contra el estado autoritativo
   * de Identity Service. Se invoca cada vez que llega un evento `identity.store.*`.
   * Idempotente: puede reintentarse de forma segura ante fallos de red.
   */
  reconcile(storeId: string): Promise<void>;
}
