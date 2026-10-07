# Enabling AI Insights (OpenAI API Key Setup)

## Why you saw the error

```
java.lang.IllegalArgumentException: OpenAI API key must be set.
  at OpenAiAudioSpeechAutoConfiguration.openAiAudioSpeechModel(...)
```

Spring AI 1.0.0 auto-configures **every** OpenAI model type — chat, embedding,
image, audio speech, audio transcription and moderation. Each one asserts an API
key is present at startup. We only use **chat**, so the other five are now
switched off in `application.properties`:

```properties
spring.ai.model.chat=${SPRING_AI_CHAT:none}
spring.ai.model.embedding=none
spring.ai.model.image=none
spring.ai.model.audio.speech=none
spring.ai.model.audio.transcription=none
spring.ai.model.moderation=none
```

The app now **boots with no key at all** and falls back to deterministic
rule-based insights (`"insightSource": "RULE_BASED"` in the response).

---

## Troubleshooting

### `No qualifying bean of type 'ChatModel' available`

```
Error creating bean with name 'chatClientBuilder' ...
Unsatisfied dependency ... parameter 1:
No qualifying bean of type 'org.springframework.ai.chat.model.ChatModel' available
```

Spring AI *always* registers a `chatClientBuilder` bean definition, even when no
`ChatModel` exists. Asking the context for that builder therefore instantiates
it and fails.

`RetirementAiAdvisor` avoids this by depending on `ObjectProvider<ChatModel>`
and constructing the client itself:

```java
ChatModel chatModel = chatModelProvider.getIfAvailable();   // null, not an exception
if (chatModel != null) {
    chatClient = ChatClient.builder(chatModel).defaultSystem(SYSTEM_PROMPT).build();
}
```

A missing `ChatModel` resolves to `null`, and the resolution is additionally
wrapped in a `try/catch`, so the endpoint degrades to the rule-based path
instead of returning HTTP 500.

**If you see this error, you are running an older build** — rebuild:

```powershell
cd demo
.\mvnw.cmd clean package
```

### `401 Unauthorized` / `invalid_api_key`

The key is wrong, revoked, or has a stray space. Regenerate it at
https://platform.openai.com/api-keys.

### `429 insufficient_quota`

The key is valid but the account has no credit. Add billing at
https://platform.openai.com/account/billing.

### Insights still say `RULE_BASED` with a key set

Check both switches are on — the chat model *and* the feature flag:

```powershell
$env:SPRING_AI_CHAT   # must be "openai"
$env:OPENAI_API_KEY   # must be set
```

`retirement.ai.enabled` must not be `false`. Environment variables are only read
when the process starts, so restart the app after setting them.

---

## How to get an OpenAI API key

1. Go to **https://platform.openai.com/signup** and create an account (or log in).
2. Open **https://platform.openai.com/api-keys**.
3. Click **"Create new secret key"**.
4. Give it a name, e.g. `cle-retirement-hub`, and choose a project.
5. Copy the key — it is shown **once only**. It looks like `sk-proj-...`.
6. Add billing at **https://platform.openai.com/account/billing** — new accounts
   need a small amount of credit before the API will answer. `gpt-4o-mini`
   (our default model) costs a fraction of a cent per request.

> Treat the key like a password. Never commit it, never put it in the React app,
> never paste it in a ticket.

---

## How to run with AI enabled

### PowerShell (current session only)

```powershell
$env:SPRING_AI_CHAT   = "openai"
$env:OPENAI_API_KEY   = "sk-proj-your-key-here"
$env:OPENAI_MODEL     = "gpt-4o-mini"   # optional

cd demo
.\mvnw.cmd spring-boot:run
```

### PowerShell (persist for your user account)

```powershell
[Environment]::SetEnvironmentVariable("SPRING_AI_CHAT", "openai", "User")
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-proj-your-key-here", "User")
# restart the terminal / IDE afterwards
```

### IntelliJ Run Configuration

`Run > Edit Configurations… > DemoApplication > Environment variables`:

```
SPRING_AI_CHAT=openai;OPENAI_API_KEY=sk-proj-your-key-here
```

### Local file that is never committed

Create `demo/src/main/resources/application-local.properties`:

```properties
spring.ai.model.chat=openai
spring.ai.openai.api-key=sk-proj-your-key-here
```

Run with the profile:

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Then add it to `.gitignore`:

```
demo/src/main/resources/application-local.properties
```

---

## Verify it worked

```powershell
curl http://localhost:8080/demo/api/v1/retirement-plans/health
```

| Response contains | Meaning |
|---|---|
| `insights=AI (Spring AI chat model active)` | Key accepted, LLM in use |
| `insights=RULE_BASED (no chat model)` | No key / AI disabled, fallback in use |

Then run a real query and check the `insightSource` field:

```powershell
$q = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options."
$r = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/demo/api/v1/retirement-plans/from-query?query=$([uri]::EscapeDataString($q))"
$r.insightSource      # "AI" or "RULE_BASED"
$r.pensionPot         # 500000
$r.executiveSummary
```

---

## Alternatives if you have no OpenAI account

The app is model-agnostic through Spring AI. Swap the starter in `demo/pom.xml`:

| Provider | Artifact | Notes |
|---|---|---|
| Azure OpenAI | `spring-ai-starter-model-azure-openai` | Corporate-friendly, uses your Azure tenant |
| Ollama (local, free) | `spring-ai-starter-model-ollama` | Runs `llama3`/`mistral` on your machine, no key |
| Anthropic | `spring-ai-starter-model-anthropic` | Needs an Anthropic key |

### Ollama example (no key, fully local)

```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-model-ollama</artifactId>
</dependency>
```

```properties
spring.ai.model.chat=ollama
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.options.model=llama3.1
```

No other code changes are needed — `RetirementAiAdvisor` talks to the generic
`ChatClient`, not to OpenAI directly.

---

## Cost control

```properties
spring.ai.openai.chat.options.model=gpt-4o-mini   # cheapest capable model
spring.ai.openai.chat.options.temperature=0.2     # deterministic-ish output
spring.ai.openai.chat.options.max-tokens=2000     # cap the response size
```

Each retirement plan makes at most **two** calls: one to parse the query, one to
write the narrative. Both fail safe — any error logs a warning and the response
is served from the rule-based fallback.