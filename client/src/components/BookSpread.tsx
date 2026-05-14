import { useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, RefreshCw, Loader2, Paintbrush } from 'lucide-react'
import type { BookWithPages, Page } from '../types'

interface BookSpreadProps {
  book: BookWithPages;
  isOwner: boolean;
  isDraft: boolean;
  illustrating: boolean;
  onIllustratePage: (pageNumber: number, feedback?: string) => Promise<void>;
  onRevise: (feedback: string) => Promise<void>;
  revising: boolean;
  reviseError?: string;
}

type SpreadKind =
  | { kind: 'cover' }
  | { kind: 'story'; page: Page; pageIndex: number }
  | { kind: 'end' }

export default function BookSpread({
  book,
  isOwner,
  isDraft,
  illustrating,
  onIllustratePage,
  onRevise,
  revising,
  reviseError,
}: BookSpreadProps) {
  const pages = book.pages || []
  const spreads: SpreadKind[] = [
    { kind: 'cover' },
    ...pages.map((page, pageIndex) => ({ kind: 'story' as const, page, pageIndex })),
    { kind: 'end' as const },
  ]

  const [spreadIndex, setSpreadIndex] = useState(0)
  const [flipping, setFlipping] = useState<'next' | 'prev' | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [illustrationFeedback, setIllustrationFeedback] = useState('')

  const spread = spreads[spreadIndex]
  const canPrev = spreadIndex > 0
  const canNext = spreadIndex < spreads.length - 1

  const turnPage = (dir: 'next' | 'prev'): void => {
    if (flipping) return
    if (dir === 'next' && !canNext) return
    if (dir === 'prev' && !canPrev) return
    setFlipping(dir)
    setTimeout(() => {
      setSpreadIndex(i => dir === 'next' ? i + 1 : i - 1)
      setFlipping(null)
    }, 250)
  }

  const handleSubmitFeedback = async (): Promise<void> => {
    if (!feedback.trim()) return
    await onRevise(feedback)
    setFeedback('')
    setShowFeedback(false)
    setSpreadIndex(0)
  }

  const handleRegeneratePageIllustration = async (pageNumber: number): Promise<void> => {
    await onIllustratePage(pageNumber, illustrationFeedback.trim() || undefined)
    setIllustrationFeedback('')
  }

  const flipClass =
    flipping === 'next' ? 'opacity-0 -translate-x-4' :
    flipping === 'prev' ? 'opacity-0 translate-x-4' :
    'opacity-100 translate-x-0'

  return (
    <div className="bg-amber-50 dark:bg-gray-900 rounded-3xl shadow-lg p-4 md:p-8 transition-colors mb-8">
      {/* Spine + book frame */}
      <div
        className="relative mx-auto bg-amber-100 dark:bg-gray-800 rounded-2xl shadow-2xl border border-amber-200 dark:border-gray-700"
        style={{
          maxWidth: '900px',
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 4%, transparent 49%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.18) 50%, transparent 51%, transparent 96%, rgba(0,0,0,0.08) 100%)',
        }}
      >
        <div className={`grid grid-cols-2 min-h-[400px] md:min-h-[480px] transition-all duration-200 ease-in-out ${flipClass}`}>
          {spread.kind === 'cover' && (
            <>
              <PageCanvas side="left">
                <div className="text-center text-amber-700 dark:text-amber-300/60 italic text-sm self-center">
                  {book.is_user_created ? 'A story written just for you' : null}
                </div>
              </PageCanvas>
              <PageCanvas side="right">
                <div
                  className="flex flex-col items-center justify-center h-full p-8 text-center rounded-r-xl"
                  style={{ backgroundColor: book.cover_color + '20' }}
                >
                  {book.cover_url ? (
                    <img
                      src={`http://localhost:3001${book.cover_url}`}
                      alt={book.title}
                      className="max-h-48 md:max-h-64 rounded-xl shadow-md mb-4"
                    />
                  ) : (
                    <div className="text-7xl md:text-8xl mb-4 drop-shadow-xl">{book.cover_emoji}</div>
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">{book.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">by {book.author}</p>
                </div>
              </PageCanvas>
            </>
          )}

          {spread.kind === 'story' && (
            <>
              <PageCanvas side="left">
                <PageIllustration
                  page={spread.page}
                  isOwner={isOwner}
                  isDraft={isDraft}
                  illustrating={illustrating}
                  feedback={illustrationFeedback}
                  onFeedbackChange={setIllustrationFeedback}
                  onRegenerate={() => void handleRegeneratePageIllustration(spread.page.page_number)}
                />
              </PageCanvas>
              <PageCanvas side="right">
                <div className="flex-1 flex flex-col justify-between p-2">
                  <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed font-display">
                    {spread.page.text}
                  </p>
                  <div className="text-right text-xs text-amber-700/60 dark:text-amber-300/40 mt-4 italic">
                    — page {spread.page.page_number}
                  </div>
                </div>
              </PageCanvas>
            </>
          )}

          {spread.kind === 'end' && (
            <>
              <PageCanvas side="left">
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <div className="text-3xl font-bold text-gray-700 dark:text-gray-200 font-display mb-2">The End</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Hope you enjoyed the story.</p>
                </div>
              </PageCanvas>
              <PageCanvas side="right">
                <div className="flex-1 flex items-center justify-center text-center p-6 text-gray-400 dark:text-gray-500 text-sm italic">
                  {book.description}
                </div>
              </PageCanvas>
            </>
          )}
        </div>

        {/* Page turn controls */}
        <button
          onClick={() => turnPage('prev')}
          disabled={!canPrev || !!flipping}
          aria-label="Previous spread"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-700 shadow-md flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-white border-none text-amber-700 dark:text-amber-300"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => turnPage('next')}
          disabled={!canNext || !!flipping}
          aria-label="Next spread"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-700 shadow-md flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-white border-none text-amber-700 dark:text-amber-300"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Footer: position dots + revise CTA */}
      <div className="flex flex-col md:flex-row items-center justify-between mt-4 gap-3 max-w-[900px] mx-auto">
        <div className="flex gap-1.5">
          {spreads.map((_, i) => (
            <button
              key={i}
              onClick={() => setSpreadIndex(i)}
              aria-label={`Go to spread ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer border-none ${
                i === spreadIndex ? 'bg-amber-500' : 'bg-amber-200 dark:bg-gray-600 hover:bg-amber-300'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {spread.kind === 'cover' ? 'Cover' : spread.kind === 'end' ? 'End' : `Page ${spread.pageIndex + 1} of ${pages.length}`}
        </span>
        {isOwner && isDraft && (
          <button
            onClick={() => setShowFeedback(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 cursor-pointer border-none"
          >
            <RefreshCw size={14} />
            {showFeedback ? 'Cancel' : 'Suggest changes'}
          </button>
        )}
      </div>

      {/* Inline revision panel (only when the user opens it from the spread footer) */}
      {isOwner && isDraft && showFeedback && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-[900px] mx-auto border-2 border-purple-200 dark:border-purple-800">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Describe what you'd like changed and the AI author will create a revised version.
          </p>
          <textarea
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            placeholder="e.g., Make the ending happier, change the dragon to a unicorn, page 3 is too scary..."
            disabled={revising}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-400 focus:outline-none text-sm h-24 resize-none placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
            maxLength={1000}
          />
          {reviseError && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-xl mt-3 text-sm">
              {reviseError}
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">{feedback.length}/1000</span>
            <button
              onClick={() => void handleSubmitFeedback()}
              disabled={revising || !feedback.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-shadow cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              {revising ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {revising ? 'Revising...' : 'Revise Story'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PageCanvas({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  const radius = side === 'left' ? 'rounded-l-xl' : 'rounded-r-xl'
  const innerShadow =
    side === 'left'
      ? 'shadow-[inset_-8px_0_12px_-12px_rgba(0,0,0,0.4)]'
      : 'shadow-[inset_8px_0_12px_-12px_rgba(0,0,0,0.4)]'
  return (
    <div className={`bg-white dark:bg-gray-800 ${radius} ${innerShadow} p-4 md:p-6 flex flex-col`}>
      {children}
    </div>
  )
}

interface PageIllustrationProps {
  page: Page;
  isOwner: boolean;
  isDraft: boolean;
  illustrating: boolean;
  feedback: string;
  onFeedbackChange: (v: string) => void;
  onRegenerate: () => void;
}

function PageIllustration({ page, isOwner, isDraft, illustrating, feedback, onFeedbackChange, onRegenerate }: PageIllustrationProps) {
  if (page.illustration_url) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 rounded-xl overflow-hidden shadow-md">
          <img
            src={`http://localhost:3001${page.illustration_url}`}
            alt={page.illustration_description}
            className="w-full h-full object-cover"
          />
        </div>
        {isOwner && isDraft && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFeedbackChange(e.target.value)}
              placeholder="warmer colors, more stars..."
              disabled={illustrating}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-xs focus:border-purple-400 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
            />
            <button
              onClick={onRegenerate}
              disabled={illustrating}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 cursor-pointer border-none disabled:opacity-40 whitespace-nowrap"
            >
              {illustrating ? <Loader2 size={12} className="animate-spin" /> : <Paintbrush size={12} />}
              Redo
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-amber-100/60 to-amber-200/40 dark:from-gray-700 dark:to-gray-700/60 rounded-xl p-4 border-2 border-dashed border-amber-300 dark:border-gray-600 text-center">
      <ImageIcon size={32} className="text-amber-400 dark:text-amber-300/50 mb-2" />
      <p className="text-xs text-amber-700 dark:text-amber-300/80 italic mb-3 leading-snug">
        {page.illustration_description}
      </p>
      {isOwner && isDraft && (
        <button
          onClick={onRegenerate}
          disabled={illustrating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 cursor-pointer border-none disabled:opacity-40"
        >
          {illustrating ? <Loader2 size={12} className="animate-spin" /> : <Paintbrush size={12} />}
          {illustrating ? 'Drawing...' : 'Generate illustration'}
        </button>
      )}
    </div>
  )
}
