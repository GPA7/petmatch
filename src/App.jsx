import { useState, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ReactMarkdown from 'react-markdown'
import { pingSupabase, supabase } from './supabaseClient'
import Login from './Login'

function App() {
  const apiKey = import.meta.env.VITE_GEMMA_API_KEY

  const [session, setSession] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aiText, setAiText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelsText, setModelsText] = useState('')
  const [isSupabaseLoading, setIsSupabaseLoading] = useState(false)
  const [supabaseStatus, setSupabaseStatus] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSearch = async () => {
    if (!apiKey) {
      setError('API key mancante: aggiungi VITE_GEMMA_API_KEY in .env.local')
      setAiText('')
      return
    }

    setError('')
    setIsLoading(true)
    setAiText('')

    try {
      const { data: dogs, error: dogsError } = await supabase.from('dogs').select('*')
      if (dogsError) {
        throw dogsError
      }

      const enrichedPrompt = `Sei un esperto cinofilo. L'utente cerca: '${prompt}'. Abbiamo SOLO questi cani disponibili nel rifugio: ${JSON.stringify(dogs || [])}. Se uno di questi cani corrisponde alla richiesta, consigliolo con entusiasmo descrivendolo. Altrimenti dai consigli generali. Ogni cane nella lista ha un campo 'image_url'. Se consigli uno specifico cane, DEVI includere la sua foto alla fine della risposta usando la sintassi Markdown esatta: ![Nome Cane](URL_IMMAGINE).`

      const genAI = new GoogleGenerativeAI(apiKey, {
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1',
      })
      const modelId = 'models/gemma-3-12b-it'
      const model = genAI.getGenerativeModel({ model: modelId })
      console.log('Sto chiamando il modello:', modelId)
      const result = await model.generateContent(enrichedPrompt)
      const text = result.response.text()
      setAiText(text)
      setError('')
    } catch (error) {
      console.error('Errore completo durante la generazione:', error)
      console.error('Stack trace:', error?.stack)
      console.error('Messaggio:', error?.message)
      console.error(
        'Oggetto errore completo:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      )

      const maybe429 =
        typeof error?.message === 'string' && error.message.includes('429')
      const friendly =
        maybe429
          ? 'Quota superata: attendi qualche secondo o usa un modello più leggero.'
          : error.message || 'Errore sconosciuto durante la generazione.'

      const detailed = JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
        2,
      )

      setError(`${friendly}\n\nDettagli:\n${detailed}`)
      alert(error?.message || 'Errore durante la generazione.')
      setAiText('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleListModels = async () => {
    if (!apiKey) {
      setError('API key mancante: aggiungi VITE_GEMMA_API_KEY in .env.local')
      return
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const names =
        data?.models?.map(
          (m) =>
            `${m.name} (${m.supportedGenerationMethods?.join(', ') || 'no methods'})`,
        ) || []
      const output = names.length ? names.join('\n') : 'Nessun modello disponibile'
      setModelsText(output)
      setError('')
      console.log('Modelli disponibili (REST):', names)
    } catch (error) {
      console.error('Errore nel listModels (REST):', error)
      setError('ERRORE GOOGLE listModels: ' + error.message)
    }
  }

  const handleSupabaseTest = async () => {
    setSupabaseStatus('')
    setIsSupabaseLoading(true)
    try {
      const { data, error: supaError } = await pingSupabase()
      if (supaError) {
        setSupabaseStatus(`Errore Supabase: ${supaError.message}`)
      } else {
        setSupabaseStatus(`Supabase OK: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      setSupabaseStatus(`Errore Supabase: ${err?.message || 'sconosciuto'}`)
    } finally {
      setIsSupabaseLoading(false)
    }
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-red-500 text-white">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_35%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-14 md:px-10 lg:px-12">
          <header className="flex items-center justify-between text-sm font-semibold tracking-tight text-white/90">
            <span className="rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80">
              PetMatch
            </span>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
                Canine Matchmaking
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/90 transition duration-150 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                Esci
              </button>
            </div>
          </header>

          <main className="flex flex-1 flex-col justify-center gap-10">
            <div className="max-w-3xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80">
                Matchmaking canino potenziato dall&apos;AI
              </p>
              <h1 className="text-4xl font-bold leading-tight drop-shadow-sm md:text-5xl lg:text-6xl">
                Trova l&apos;anima gemella per il tuo cane
              </h1>
              <p className="text-lg text-white/85 md:text-xl">
                L&apos;intelligenza artificiale che unisce cuori a quattro zampe
                con abbinamenti pensati su misura per carattere, energia e
                affinità.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 px-6 py-3 text-lg font-semibold text-white shadow-xl shadow-orange-900/30 transition duration-150 hover:-translate-y-[1px] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">
                Inizia il Matching
              </button>
              <span className="text-sm text-white/80">
                Trova il match perfetto per il tuo amico a quattro zampe.
              </span>
            </div>
          </main>

          <section className="relative -mb-4 mt-4 w-full rounded-3xl border border-white/20 bg-white/10 p-6 shadow-lg shadow-orange-900/20 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Integrazione AI
                </p>
                <p className="text-xl font-semibold">
                  Descrivi il tuo cane ideale o il tuo stile di vita
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Descrivi il tuo cane ideale... o il tuo stile di vita"
                    className="w-full rounded-full border border-white/25 bg-white/15 px-4 py-3 text-base text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 sm:w-96"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-orange-700 shadow-lg shadow-orange-900/25 transition duration-150 hover:-translate-y-[1px] hover:shadow-xl hover:shadow-orange-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? 'Loading…' : 'Cerca'}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleListModels}
                    className="inline-flex w-fit items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85 shadow-sm shadow-orange-900/20 transition duration-150 hover:-translate-y-[1px] hover:border-white/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                  >
                    Lista modelli disponibili
                  </button>
                  <button
                    onClick={handleSupabaseTest}
                    disabled={isSupabaseLoading}
                    className="inline-flex w-fit items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85 shadow-sm shadow-orange-900/20 transition duration-150 hover:-translate-y-[1px] hover:border-white/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSupabaseLoading ? 'Ping Supabase…' : 'Test Supabase'}
                  </button>
                  {modelsText && (
                    <div className="rounded-2xl border border-white/20 bg-white/5 p-3 text-xs text-white/85">
                      <pre className="whitespace-pre-wrap break-words">{modelsText}</pre>
                    </div>
                  )}
                  {supabaseStatus && (
                    <div className="rounded-2xl border border-white/20 bg-white/5 p-3 text-xs text-white/90">
                      <pre className="whitespace-pre-wrap break-words">{supabaseStatus}</pre>
                    </div>
                  )}
                </div>
                <p className="text-sm text-white/75">
                  Al click su &quot;Cerca&quot; invochiamo Gemma 3 e mostriamo la risposta generata.
                </p>
                {error && (
                  <div className="mt-3 rounded-xl border border-red-300/50 bg-red-50/90 p-6 backdrop-blur">
                    <p className="text-sm font-semibold text-red-800">Errore</p>
                    <p className="mt-1 text-sm leading-relaxed text-red-700">{error}</p>
                  </div>
                )}
                {aiText && (
                  <div className="mt-3 rounded-xl border border-gray-200/50 bg-white/90 p-6 backdrop-blur shadow-lg">
                    <div className="text-gray-800 [&>h1]:mb-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:text-xl [&>h2]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:text-lg [&>h3]:font-semibold [&>p]:mb-3 [&>p]:leading-relaxed [&>ul]:mb-3 [&>ul]:ml-6 [&>ul]:list-disc [&>ol]:mb-3 [&>ol]:ml-6 [&>ol]:list-decimal [&>li]:mb-1 [&>li]:leading-relaxed [&>strong]:font-semibold [&>em]:italic [&>code]:rounded [&>code]:bg-gray-100 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:text-sm [&>code]:font-mono [&>pre]:mb-3 [&>pre]:overflow-x-auto [&>pre]:rounded-lg [&>pre]:bg-gray-100 [&>pre]:p-3 [&>pre]:text-sm [&>blockquote]:mb-3 [&>blockquote]:border-l-4 [&>blockquote]:border-gray-300 [&>blockquote]:pl-4 [&>blockquote]:italic">
                      <ReactMarkdown>{aiText}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
              <span className="self-start rounded-full border border-white/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
                Gemma 3 in arrivo
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
