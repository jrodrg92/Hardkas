/**
 * Branded Types for Strong ID Discipline.
 * 
 * These types prevent accidental misuse of raw strings across the monorepo.
 * For example, you cannot pass a KaspaAddress to a function expecting a TxId.
 */

export type Branded<K, T> = T & { __brand: K };

/**
 * A canonical 32-byte hash (64 characters hex) representing a Kaspa Transaction.
 */
export type TxId = Branded<"TxId", string>;

/**
 * A Kaspa Address (e.g. kaspa:..., kaspatest:...).
 */
export type KaspaAddress = Branded<"KaspaAddress", string>;

/**
 * A unique identifier for a HardKAS Artifact.
 */
export type ArtifactId = Branded<"ArtifactId", string>;

/**
 * A correlation ID that spans across L1 and L2 transactions.
 */
export type LineageId = Branded<"LineageId", string>;

/**
 * Cast helpers for boundaries (use with caution, ideally after validation).
 */
export const asTxId = (id: string) => id as TxId;
export const asKaspaAddress = (addr: string) => addr as KaspaAddress;
export const asArtifactId = (id: string) => id as ArtifactId;
export const asLineageId = (id: string) => id as LineageId;
