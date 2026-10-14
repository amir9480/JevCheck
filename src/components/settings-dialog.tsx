import {useEffect, useRef, useState} from 'react'
import {ExternalLink, KeyRound, Plus, Settings, Trash2} from 'lucide-react'
import {useConfirm} from '@/components/confirm-dialog'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {PortalContainerContext} from '@/components/portal-container'
import {Combobox} from '@/components/ui/combobox'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {Separator} from '@/components/ui/separator'
import {Spinner} from '@/components/ui/spinner'
import {
  CUSTOM_PROTOCOLS,
  PROVIDERS,
  decide,
  listModels,
  providerById,
  type DecisionProtocol,
  type ProviderId
} from '@/lib/decision/client'
import {ensureOriginAccess, hasOriginAccess} from '@/lib/origin-access'
import {toProviderConfig, type useKeys} from '@/lib/use-keys'

type Keys = ReturnType<typeof useKeys>

const CUSTOM_MODEL = '__custom__'

const mask =(apiKey: string) => `••••${apiKey.slice(-4)}`

export function SettingsDialog({
  keys,
  open,
  onOpenChange
}: {
  keys: Keys
  /** Optional control, so the app can open the dialog (e.g. after onboarding). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent
        ref={setContainer}
        className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg"
      >
        <PortalContainerContext.Provider value={container}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Bring your own API keys. The selected key is used for evaluations. Keys are
            encrypted before being stored in this browser profile.
          </DialogDescription>
        </DialogHeader>

        {/* Padding + negative margin keep focus rings and borders from being clipped. */}
        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2">
          {keys.wasReset && (
            <Alert variant="destructive">
              <AlertTitle>Saved keys were removed</AlertTitle>
              <AlertDescription className="gap-2">
                <p>The encryption key was lost or did not match, so all API keys were deleted.</p>
                <Button size="sm" variant="outline" onClick={keys.dismissReset}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <KeyList keys={keys} />
          <Separator />
          <AddKeyDialog onAdd={keys.addKey} />
        </div>
        </PortalContainerContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

function KeyList({keys}: {keys: Keys}) {
  const confirm = useConfirm()
  if (!keys.isLoaded) return <Spinner />
  if (keys.keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No API keys yet. Add one below.</p>
  }
  return (
    <RadioGroup
      value={keys.activeKey?.id ?? ''}
      onValueChange={(id) => void keys.setActive(id)}
      className="gap-2"
    >
      {keys.keys.map((key) => (
        <div key={key.id} className="flex items-center gap-3 rounded-md border p-2.5">
          <RadioGroupItem value={key.id} id={`key-${key.id}`} aria-label={`Use ${key.label}`} />
          <Label htmlFor={`key-${key.id}`} className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5">
            <span className="flex w-full items-center gap-2">
              <span className="truncate">{key.label}</span>
              <Badge variant="secondary">{providerById(key.providerId).label}</Badge>
              {providerById(key.providerId).badge && (
                <Badge variant="outline">{providerById(key.providerId).badge}</Badge>
              )}
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              {mask(key.apiKey)}
            </span>
          </Label>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${key.label}`}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete "${key.label}"?`,
                description: 'The saved API key is removed from this browser.'
              })
              if (ok) void keys.removeKey(key.id)
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </RadioGroup>
  )
}

/** The "Add an API key" form lives in its own dialog, closed once the key is saved. */
function AddKeyDialog({onAdd}: {onAdd: Keys['addKey']}) {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Add an API key
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={setContainer} className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
          <PortalContainerContext.Provider value={container}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <KeyRound className="size-4" /> Add an API key
              </DialogTitle>
              <DialogDescription>
                The key is tested before it is saved, and encrypted in this browser profile.
              </DialogDescription>
            </DialogHeader>
            <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <AddKeyForm
                onAdd={async (key) => {
                  await onAdd(key)
                  setOpen(false)
                }}
                onCancel={() => setOpen(false)}
              />
            </div>
          </PortalContainerContext.Provider>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddKeyForm({onAdd, onCancel}: {onAdd: Keys['addKey']; onCancel: () => void}) {
  const [providerId, setProviderId] = useState<ProviderId>('typesafe')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [protocol, setProtocol] = useState<DecisionProtocol>('openai')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [models, setModels] = useState<string[] | null>(null)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const provider = providerById(providerId)
  const isCustom = providerId === 'custom'
  const hasKey = !!apiKey.trim()

  // Bumped on every load and reset, so a slower answer for an earlier provider is ignored.
  const modelsRequest = useRef(0)

  // A loaded list belongs to one provider + key + endpoint; drop it when any of them change.
  function resetModels() {
    modelsRequest.current++
    setIsLoadingModels(false)
    setModels(null)
    setUseCustomModel(false)
    setModelsError(null)
  }

  // Model lists are public, so no key is needed. Host access may still have to be requested,
  // which only works from a user gesture (opening the dropdown).
  async function loadModels(requestAccess: boolean) {
    const config = toProviderConfig({
      id: '',
      providerId,
      label: '',
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined
    })
    if (!config || isCustom) return
    const request = ++modelsRequest.current
    const isCurrent = () => request === modelsRequest.current
    setIsLoadingModels(true)
    setModelsError(null)
    try {
      if (requestAccess) await ensureOriginAccess(config.baseUrl)
      else if (!(await hasOriginAccess(config.baseUrl))) return
      const ids = await listModels(config)
      if (!isCurrent()) return
      setModels(ids)
      setModel((current) =>
        current || (ids.includes(provider.model ?? '') ? provider.model! : ids[0])
      )
    } catch (err) {
      if (!isCurrent()) return
      setModels(null)
      setModelsError(
        `${err instanceof Error ? err.message : String(err)} Enter the model name manually.`
      )
    } finally {
      if (isCurrent()) setIsLoadingModels(false)
    }
  }

  // Fetch the list as soon as a known provider is chosen, if its host is already approved.
  useEffect(() => {
    resetModels()
    if (isCustom || !hasKey) return
    const timer = setTimeout(() => void loadModels(false), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, baseUrl, hasKey])

  const canSave =
    !!apiKey.trim() && (!isCustom || (!!baseUrl.trim() && !!model.trim())) && !isSaving

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setIsSaving(true)
    setError(null)
    try {
      const entry = {
        providerId,
        label: label.trim() || provider.label,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        protocol: isCustom ? protocol : undefined
      }
      const config = toProviderConfig({...entry, id: ''})
      if (!config) throw new Error('Base URL and model are required.')
      // Must stay the first await so the permission prompt keeps the click's user gesture.
      await ensureOriginAccess(config.baseUrl)
      // Test the key before saving it.
      await decide(config, {
        state: 'The sky is blue.',
        questions: {test: {type: 'boolean', instructions: 'Is the sky blue?'}}
      })
      await onAdd(entry)
      setLabel('')
      setApiKey('')
      setBaseUrl('')
      setModel('')
    } catch (err) {
      setError(
        err instanceof TypeError && err.message.includes('URL')
          ? 'Enter a valid base URL, e.g. https://example.com/v1'
          : err instanceof Error
            ? err.message
            : String(err)
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Provider</Label>
        <Select
          value={providerId}
          onValueChange={(value) => {
            setProviderId(value as ProviderId)
            setModel('')
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
                {p.badge && <Badge variant="outline">{p.badge}</Badge>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <div className="flex flex-col gap-1.5">
          <Label>API type</Label>
          <Select value={protocol} onValueChange={(value) => setProtocol(value as DecisionProtocol)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key-label">Name (optional)</Label>
        <Input
          id="key-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={provider.label}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key-secret">API key</Label>
        <Input
          id="key-secret"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {provider.keyUrl && (
            <a
              href={provider.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              Get your {provider.label} API key <ExternalLink className="size-3" />
            </a>
          )}
          {provider.privacyUrl && (
            <a
              href={provider.privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              Privacy policy <ExternalLink className="size-3" />
            </a>
          )}
          {provider.termsUrl && (
            <a
              href={provider.termsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              Terms <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key-base">Base URL{isCustom ? '' : ' (optional)'}</Label>
        <Input
          id="key-base"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={provider.baseUrl ?? 'https://api.example.com/v1'}
        />
      </div>

      {(isCustom || hasKey) && (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="key-model">Model{isCustom ? '' : ' (optional)'}</Label>
        {!isCustom && !modelsError && (
          <Combobox
            id="key-model"
            options={[
              ...(models ?? []).map((id) => ({value: id})),
              {value: CUSTOM_MODEL, label: 'Custom…'}
            ]}
            value={useCustomModel ? CUSTOM_MODEL : model}
            onValueChange={(value) => {
              setUseCustomModel(value === CUSTOM_MODEL)
              setModel(value === CUSTOM_MODEL ? '' : value)
            }}
            onOpenChange={(open) => {
              if (open && !models && !isLoadingModels) void loadModels(true)
            }}
            isLoading={isLoadingModels}
            placeholder={provider.model ?? 'Select a model'}
            searchPlaceholder="Search models…"
            emptyText="No matching models."
          />
        )}
        {(isCustom || modelsError || useCustomModel) && (
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={provider.model ?? 'model-name'}
            aria-label="Model name"
          />
        )}
        {modelsError && <p className="text-xs text-muted-foreground">{modelsError}</p>}
      </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave}>
          {isSaving && <Spinner />}
          Add key
        </Button>
      </DialogFooter>
    </form>
  )
}
