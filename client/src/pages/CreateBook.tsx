import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface ThemeOption {
  value: string;
  label: string;
  emoji: string;
}

const THEMES: ThemeOption[] = [
  { value: 'adventure', label: 'Adventure', emoji: '\u{1F3D4}\u{FE0F}' },
  { value: 'fantasy', label: 'Fantasy', emoji: '\u{1FA84}' },
  { value: 'friendship', label: 'Friendship', emoji: '\u{1F49B}' },
  { value: 'humor', label: 'Humor', emoji: '\u{1F602}' },
  { value: 'nature', label: 'Nature', emoji: '\u{1F33F}' },
  { value: 'imagination', label: 'Imagination', emoji: '\u{1F308}' },
  { value: 'animals', label: 'Animals', emoji: '\u{1F43E}' },
  { value: 'space', label: 'Space', emoji: '\u{1F680}' },
]

const AGE_RANGES: string[] = ['2-4', '3-6', '4-7', '5-9', '6-10']

export default function CreateBook() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [theme, setTheme] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [additionalDetails, setAdditionalDetails] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const canProceed = (): boolean => {
    if (step === 1) return theme !== ''
    if (step === 2) return characterName.trim() !== '' && ageRange !== ''
    return true
  }

  const handleGenerate = async (): Promise<void> => {
    setGenerating(true)
    setError('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ theme, characterName, ageRange, additionalDetails }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Generation failed')
      }
      const book = await res.json() as { id: string }
      navigate(`/book/${book.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
    }
  }

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-12 transition-colors">
          <Loader2 size={48} className="animate-spin text-purple-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">Creating your story...</h2>
          <p className="text-gray-500 dark:text-gray-400">Our AI author is crafting a magical tale about {characterName}. This takes about 15 seconds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 font-display mb-2">
          <Sparkles className="inline text-purple-500 mr-2" size={32} />
          Create Your Book
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Design a one-of-a-kind story in three easy steps</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
              s <= step ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-12 h-1 rounded ${s < step ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 transition-colors">
        {/* Step 1: Theme */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 font-display mb-4">Choose a Theme</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEMES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`p-4 rounded-2xl text-center transition-all cursor-pointer border-2 ${
                    theme === t.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-purple-200 dark:hover:border-purple-700'
                  }`}
                >
                  <div className="text-3xl mb-1">{t.emoji}</div>
                  <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Character & Age */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 font-display mb-4">Design Your Character</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Character Name</label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacterName(e.target.value)}
                  placeholder="e.g., Luna, Captain Bear, Zara..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-400 focus:outline-none text-lg placeholder-gray-400 dark:placeholder-gray-500"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Age Range</label>
                <div className="flex flex-wrap gap-2">
                  {AGE_RANGES.map(ar => (
                    <button
                      key={ar}
                      onClick={() => setAgeRange(ar)}
                      className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                        ageRange === ar
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Ages {ar}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Details & Generate */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 font-display mb-4">Any Special Requests?</h2>
            <textarea
              value={additionalDetails}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdditionalDetails(e.target.value)}
              placeholder="Optional: Add any special details, like the character's personality, a lesson you want in the story, or a specific setting..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-400 focus:outline-none text-base h-32 resize-none placeholder-gray-400 dark:placeholder-gray-500"
              maxLength={500}
            />

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 mt-4">
              <h3 className="font-bold text-purple-800 dark:text-purple-300 font-display mb-2">Your Book</h3>
              <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                <p><span className="font-semibold">Theme:</span> <span className="capitalize">{theme}</span></p>
                <p><span className="font-semibold">Character:</span> {characterName}</p>
                <p><span className="font-semibold">Ages:</span> {ageRange}</p>
                {additionalDetails && <p><span className="font-semibold">Details:</span> {additionalDetails}</p>}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-xl mt-4">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-2 rounded-xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 rounded-xl font-semibold bg-purple-500 text-white hover:bg-purple-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => void handleGenerate()}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-shadow cursor-pointer"
            >
              <Wand2 size={18} />
              Generate My Story
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
