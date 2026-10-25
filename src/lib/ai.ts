import Anthropic, {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type { Card, Deck } from '../db';
import { languageLabel, transcriptionLabel } from './languages';
import type { AiSettings } from './settings';

/** Card content as exchanged with the model ('' when absent). */
export interface CardDraft {
  word: string;
  pronunciation: string;
  translation: string;
  secondary: string;
  example: string;
  example_translation: string;
}

export interface CardUpdate {
  card_id: number;
  /** Only the fields the model wants to change. */
  changes: Partial<CardDraft>;
}

export interface AssistantReply {
  message: string;
  newCards: CardDraft[];
  updates: CardUpdate[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

const FIELDS = ['word', 'pronunciation', 'translation', 'secondary', 'example', 'example_translation'] as const;

const nullableString = { type: ['string', 'null'] };

const REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'new_cards', 'updates'],
  properties: {
    message: { type: 'string', description: 'Réponse courte à afficher, en français.' },
    new_cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...FIELDS],
        properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
      },
    },
    updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['card_id', ...FIELDS],
        properties: {
          card_id: { type: 'integer' },
          ...Object.fromEntries(FIELDS.map((f) => [f, nullableString])),
        },
      },
    },
  },
};

export class AiError extends Error {}

function client(ai: AiSettings) {
  if (!ai.apiKey) throw new AiError('Ajoutez votre clé API dans la page Compte pour utiliser l’assistant.');
  // The key belongs to the user and never leaves their device except to call the API.
  return new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true });
}

function friendlyError(err: unknown): Error {
  if (err instanceof AiError) return err;
  if (err instanceof AuthenticationError) return new AiError('Clé API refusée. Vérifiez-la dans la page Compte.');
  if (err instanceof PermissionDeniedError) return new AiError('Cette clé n’a pas accès à ce modèle.');
  if (err instanceof RateLimitError) return new AiError('Trop de requêtes pour le moment. Réessayez dans un instant.');
  if (err instanceof BadRequestError) return new AiError(`Requête refusée par l’API : ${err.message}`);
  if (err instanceof APIConnectionError) return new AiError('Impossible de joindre l’API. Êtes-vous connecté à internet ?');
  return err instanceof Error ? err : new Error(String(err));
}

function systemPrompt(deck: Deck): string {
  const target = languageLabel(deck.targetLang);
  const native = languageLabel(deck.nativeLang);
  const secondary = deck.secondaryLang ? languageLabel(deck.secondaryLang) : '';
  const transcription = deck.transcription !== 'none' ? transcriptionLabel(deck.transcription) : '';
  return [
    'Tu es l’assistant d’une application de cartes mémoire (répétition espacée) pour apprendre les langues.',
    `Deck « ${deck.name} » : langue étudiée ${target}, traduction en ${native}.`,
    'Champs d’une carte :',
    `- word : le mot ou l’expression en ${target}, dans son écriture usuelle${deck.targetLang === 'yue' ? ' (caractères traditionnels de Hong Kong, registre oral cantonais)' : ''}.`,
    transcription
      ? `- pronunciation : la transcription ${transcription} de word.`
      : '- pronunciation : chaîne vide (pas de transcription pour ce deck).',
    `- translation : la traduction en ${native}, courte et naturelle.`,
    secondary
      ? `- secondary : la traduction en ${secondary}.`
      : '- secondary : chaîne vide (pas de traduction secondaire pour ce deck).',
    `- example : une phrase d’exemple courte et courante en ${target} utilisant word.`,
    `- example_translation : la traduction de l’exemple en ${native}${transcription ? `, précédée de sa transcription ${transcription} puis « — »` : ''}.`,
    'Règles :',
    '- new_cards : les cartes à créer. N’ajoute pas de mot déjà présent dans le deck.',
    '- updates : les corrections de cartes existantes, identifiées par card_id ; mets null pour chaque champ inchangé.',
    '- N’invente pas de changements que l’utilisateur n’a pas demandés, sauf erreur manifeste qu’il faut signaler dans message.',
    '- message : une réponse brève en français qui résume ce que tu proposes. L’utilisateur validera les cartes avant leur ajout.',
  ].join('\n');
}

function deckContext(cards: Card[]): string {
  if (!cards.length) return 'Le deck est vide.';
  const lines = cards
    .slice(0, 400)
    .map((c) => `#${c.id} | ${c.word} | ${c.pronunciation} | ${c.translation} | ${c.secondary}`);
  return `Cartes existantes (id | mot | prononciation | traduction | traduction secondaire) :\n${lines.join('\n')}`;
}

function history(turns: ChatTurn[]): string {
  const recent = turns.slice(-8);
  if (!recent.length) return '';
  return (
    'Échanges précédents de cette conversation :\n' +
    recent.map((t) => `${t.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${t.text}`).join('\n') +
    '\n\n'
  );
}

function usesServerFallback(model: string) {
  return model === 'claude-opus-5-5' || model === 'claude-sonnet-5-5';
}

async function request(ai: AiSettings, deck: Deck, userText: string): Promise<AssistantReply> {
  const anthropic = client(ai);
  try {
    const response = await anthropic.beta.messages.create({
      model: ai.model,
      max_tokens: 16000,
      system: systemPrompt(deck),
      messages: [{ role: 'user', content: userText }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
      ...(usesServerFallback(ai.model)
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    });
    if (response.stop_reason === 'refusal') throw new AiError('L’IA a refusé cette demande.');
    if (response.stop_reason === 'max_tokens') throw new AiError('Réponse trop longue : demandez moins de cartes à la fois.');
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return parseReply(text);
  } catch (err) {
    throw friendlyError(err);
  }
}

export function parseReply(text: string): AssistantReply {
  let raw: {
    message?: string;
    new_cards?: Partial<CardDraft>[];
    updates?: ({ card_id: number } & Partial<Record<keyof CardDraft, string | null>>)[];
  };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError('Réponse de l’IA illisible. Réessayez.');
  }
  const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
  return {
    message: clean(raw.message),
    newCards: (raw.new_cards ?? [])
      .map((c) => Object.fromEntries(FIELDS.map((f) => [f, clean(c[f])])) as unknown as CardDraft)
      .filter((c) => c.word && c.translation),
    updates: (raw.updates ?? [])
      .map((u) => ({
        card_id: u.card_id,
        changes: Object.fromEntries(
          FIELDS.flatMap((f) => (typeof u[f] === 'string' ? [[f, (u[f] as string).trim()]] : [])),
        ) as Partial<CardDraft>,
      }))
      .filter((u) => Number.isInteger(u.card_id) && Object.keys(u.changes).length > 0),
  };
}

export function askAssistant(ai: AiSettings, deck: Deck, cards: Card[], turns: ChatTurn[], text: string) {
  return request(ai, deck, `${deckContext(cards)}\n\n${history(turns)}Demande : ${text}`);
}

/** Fills the empty fields of a card being written by hand. */
export async function completeCard(ai: AiSettings, deck: Deck, draft: CardDraft): Promise<CardDraft> {
  const known = FIELDS.filter((f) => draft[f]).map((f) => `${f} : ${draft[f]}`).join('\n');
  const reply = await request(
    ai,
    deck,
    `Complète cette carte en gardant les champs déjà remplis tels quels. Renvoie exactement une carte dans new_cards et aucune mise à jour.\n${known}`,
  );
  const card = reply.newCards[0];
  if (!card) throw new AiError(reply.message || 'L’IA n’a pas pu compléter la carte.');
  return Object.fromEntries(FIELDS.map((f) => [f, draft[f] || card[f]])) as unknown as CardDraft;
}

/** Checks the key without spending tokens. */
export async function testConnection(ai: AiSettings): Promise<string> {
  try {
    const info = await client(ai).models.retrieve(ai.model);
    return info.display_name;
  } catch (err) {
    throw friendlyError(err);
  }
}

export function draftFromCard(card: Card): CardDraft {
  return {
    word: card.word,
    pronunciation: card.pronunciation,
    translation: card.translation,
    secondary: card.secondary,
    example: card.example,
    example_translation: card.exampleTranslation,
  };
}

export function cardFieldsFromDraft(d: Partial<CardDraft>): Partial<Card> {
  const out: Partial<Card> = {};
  if (d.word !== undefined) out.word = d.word;
  if (d.pronunciation !== undefined) out.pronunciation = d.pronunciation;
  if (d.translation !== undefined) out.translation = d.translation;
  if (d.secondary !== undefined) out.secondary = d.secondary;
  if (d.example !== undefined) out.example = d.example;
  if (d.example_translation !== undefined) out.exampleTranslation = d.example_translation;
  return out;
}
