import {makeAnswer, newId, type AnswerOption, type Question} from '@/lib/question-types'
import {jobFit} from '../job-fit'
import {BRAND_COLORS} from './brand-colors'
import {gateQuestion, presetAnswers, type QuestionSetTemplate} from '../types'

/** A stable, pleasant color for a label: its hash picks the hue (golden-angle spread) at fixed saturation and lightness. */
function generatedColor(label: string): string {
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = (hash * 137.508) % 360
  const [s, l] = [0.62, 0.52]
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Each answer takes its brand color; skills without a brand get a generated one. */
const stacks = (...labels: string[]): AnswerOption[] =>
  labels.map((label) => makeAnswer(label, {color: BRAND_COLORS[label] ?? generatedColor(label)}))

const STACK_DETAILS =
  'Pick each one the posting requires, prefers or uses, even if named only in passing.'

/** One multi pick per area. Long on purpose: related technologies show up even when the posting only hints at them. */
const stackQuestion = (text: string, answers: AnswerOption[]): Question => ({
  id: newId(),
  text,
  details: STACK_DETAILS,
  type: 'multi',
  answers,
  threshold: 0.5
})

export const techJob: QuestionSetTemplate = {
  id: 'tech-job',
  name: 'Tech job',
  description: 'Job fit for software roles, plus the languages, frameworks, data stores and tools the posting uses.',
  icon: 'code',
  requireDocuments: jobFit.requireDocuments,
  documentHint: 'Upload your resume or notes. Your skills are compared with the stack the posting asks for.',
  context: `${jobFit.context}

This is a software or technical role. When a question is about technologies, treat the posting's stack as everything it requires, prefers or uses, and compare it with the technologies the documents actually show.`,
  questions: () => {
    // Job fit's own gate (any job posting) is replaced by a stricter one: non-tech postings are discarded.
    const [, ...rest] = jobFit.questions()
    const gate = gateQuestion(
      'Is this a tech job posting?',
      'Answer Yes only if the page describes a specific open position in software or IT: engineering, development, DevOps, data, security, QA, IT support or similar technical work. Answer No for non-technical jobs and for pages that are not a job posting.'
    )
    const dependsOn = {questionId: gate.id, answerIds: [gate.answers[0].id]}
    const tech: Question[] = [
      {
        id: newId(),
        text: 'How well does my experience cover the main tech stack of this job?',
        details: 'Compare the technologies the posting requires with the ones shown in the documents.',
        type: 'score',
        answers: presetAnswers('poor-excellent')
      },
      {
        id: newId(),
        text: 'Does the posting require technologies that my documents never mention?',
        type: 'boolean',
        answers: presetAnswers('no-yes')
      },
      stackQuestion(
        'Which programming languages does this job use?',
        stacks(
          'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust', 'PHP', 'Ruby', 'Kotlin', 'Swift', 'Scala', 'Elixir', 'Dart', 'R', 'Perl', 'Shell scripting', 'SQL', 'Objective-C', 'Haskell', 'Clojure', 'F#', 'Erlang', 'Lua', 'Julia', 'MATLAB', 'Groovy', 'COBOL', 'Fortran', 'Assembly', 'Solidity', 'Zig', 'Visual Basic', 'VBA', 'PL/SQL', 'T-SQL', 'PowerShell', 'Crystal', 'OCaml', 'Nim', 'Delphi/Pascal', 'Ada', 'Lisp', 'Scheme', 'Racket', 'Prolog', 'Smalltalk', 'D', 'Apex', 'ABAP', 'RPG', 'Hack', 'CoffeeScript', 'Elm', 'PureScript', 'ReScript', 'Reason', 'Vala', 'V', 'Mojo', 'Carbon', 'Move', 'Vyper', 'Cairo', 'Verilog', 'VHDL', 'SystemVerilog', 'Scratch', 'LabVIEW', 'Awk', 'sed', 'Tcl', 'Raku', 'Haxe', 'AssemblyScript', 'GDScript', 'Q#', 'Bash', 'Zsh', 'Fish', 'Batch', 'Makefile', 'CMake', 'Starlark', 'Dockerfile', 'HCL', 'YAML', 'JSON', 'XML/XSLT', 'GraphQL SDL', 'Protocol Buffers', 'HTML', 'CSS', 'SCSS/Less', 'Markdown/LaTeX', 'Common Lisp', 'Forth', 'APL/J/K', 'Wolfram', 'SAS', 'Stata', 'SPSS', 'Pine Script', 'AutoHotkey', 'AppleScript'
        )
      ),
      stackQuestion(
        'Which front-end technologies does this job use?',
        stacks(
          'React', 'Next.js', 'Vue', 'Nuxt', 'Angular', 'AngularJS', 'Svelte', 'SvelteKit', 'SolidJS', 'Qwik', 'Astro', 'Remix', 'Gatsby', 'Preact', 'Ember', 'Backbone', 'Alpine.js', 'htmx', 'Lit', 'Stencil', 'jQuery', 'Redux', 'MobX', 'Zustand', 'Recoil', 'Pinia', 'Vuex', 'NgRx', 'RxJS', 'TanStack Query', 'SWR', 'React Router', 'Tailwind CSS', 'Bootstrap', 'Material UI', 'Chakra UI', 'Ant Design', 'shadcn/ui', 'Radix', 'Styled Components', 'Emotion', 'Sass', 'Less', 'CSS Modules', 'HTML/CSS', 'Vite', 'Webpack', 'Rollup', 'esbuild', 'Parcel', 'Turbopack', 'Babel', 'npm/pnpm/Yarn', 'Storybook', 'Web Components', 'D3.js', 'Three.js', 'Canvas/WebGL', 'Framer Motion', 'GSAP', 'Figma handoff', 'Accessibility (a11y)', 'Responsive design', 'PWA', 'Micro frontends', 'Server components', 'SSR/SSG', 'State management', 'Design systems', 'Browser extensions'
        )
      ),
      stackQuestion(
        'Which back-end frameworks and API styles does this job use?',
        stacks(
          'Node.js', 'Express', 'NestJS', 'Fastify', 'Koa', 'Hapi', 'AdonisJS', 'Deno', 'Bun', 'Hono', 'Django', 'Flask', 'FastAPI', 'Pyramid', 'Tornado', 'Celery', 'Spring Boot', 'Spring', 'Quarkus', 'Micronaut', 'Jakarta EE', 'Vert.x', 'ASP.NET', '.NET Core', 'Entity Framework', 'Laravel', 'Symfony', 'CodeIgniter', 'CakePHP', 'Yii', 'Slim', 'Ruby on Rails', 'Sinatra', 'Phoenix', 'Gin', 'Echo', 'Fiber', 'Actix', 'Axum', 'Rocket', 'Ktor', 'Play Framework', 'Akka', 'Rails API', 'GraphQL', 'Apollo', 'REST APIs', 'gRPC', 'tRPC', 'SOAP', 'OpenAPI/Swagger', 'WebSockets', 'Server-sent events', 'Webhooks', 'OAuth/OIDC', 'JWT', 'SAML', 'API gateways', 'Microservices', 'Monolith', 'Serverless', 'Event-driven', 'Domain-driven design', 'CQRS', 'Clean architecture', 'Message queues', 'Background jobs', 'Cron/scheduling', 'ORMs', 'Caching', 'Rate limiting', 'Multi-tenancy', 'Service mesh', 'Dapr'
        )
      ),
      stackQuestion(
        'Which databases, queues and data tools does this job use?',
        stacks(
          'PostgreSQL', 'MySQL', 'MariaDB', 'SQL Server', 'Oracle', 'SQLite', 'Db2', 'CockroachDB', 'YugabyteDB', 'TiDB', 'PlanetScale', 'Supabase', 'Neon', 'MongoDB', 'Redis', 'Valkey', 'Memcached', 'Elasticsearch', 'OpenSearch', 'Solr', 'Algolia', 'Meilisearch', 'Cassandra', 'ScyllaDB', 'DynamoDB', 'Cosmos DB', 'Firestore', 'Firebase Realtime DB', 'CouchDB', 'Couchbase', 'Neo4j', 'ArangoDB', 'JanusGraph', 'InfluxDB', 'TimescaleDB', 'Prometheus TSDB', 'ClickHouse', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Synapse', 'DuckDB', 'Pinecone', 'Weaviate', 'Milvus', 'pgvector', 'Qdrant', 'Kafka', 'RabbitMQ', 'ActiveMQ', 'NATS', 'Pulsar', 'SQS/SNS', 'Google Pub/Sub', 'Azure Service Bus', 'Redis Streams', 'Debezium', 'Spark', 'Flink', 'Hadoop', 'Hive', 'Presto/Trino', 'Airflow', 'dbt', 'Airbyte', 'Fivetran', 'NiFi', 'Prisma', 'TypeORM', 'Hibernate', 'SQLAlchemy', 'Sequelize', 'Drizzle', 'Liquibase/Flyway', 'Data modeling', 'Stored procedures', 'Database tuning'
        )
      ),
      stackQuestion(
        'Which DevOps, cloud and infrastructure tools does this job use?',
        stacks(
          'AWS', 'Azure', 'Google Cloud', 'DigitalOcean', 'Linode', 'Hetzner', 'Heroku', 'Vercel', 'Netlify', 'Cloudflare', 'Fly.io', 'Render', 'Firebase', 'Alibaba Cloud', 'Oracle Cloud', 'IBM Cloud', 'OpenShift', 'OpenStack', 'VMware', 'On-premise', 'Docker', 'Docker Compose', 'Podman', 'Kubernetes', 'Helm', 'Kustomize', 'Istio', 'Linkerd', 'Terraform', 'OpenTofu', 'Pulumi', 'CloudFormation', 'CDK', 'Bicep', 'Ansible', 'Puppet', 'Chef', 'Salt', 'Vagrant', 'Packer', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'Travis CI', 'TeamCity', 'Azure DevOps', 'Bitbucket Pipelines', 'ArgoCD', 'Flux', 'Spinnaker', 'Tekton', 'Linux', 'Windows Server', 'Bash scripting', 'Nginx', 'Apache', 'HAProxy', 'Traefik', 'Envoy', 'Varnish', 'CDN', 'DNS', 'Load balancing', 'VPN', 'Networking', 'Lambda/Functions', 'ECS/Fargate', 'EKS/AKS/GKE', 'S3/Blob storage', 'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Sentry', 'ELK', 'Splunk', 'OpenTelemetry', 'Jaeger', 'PagerDuty', 'CloudWatch', 'Nagios', 'Zabbix', 'SRE', 'Incident response', 'Cost optimization', 'Disaster recovery', 'Security hardening', 'Vault', 'IAM'
        )
      ),
      stackQuestion(
        'Which testing, data/AI, mobile and tooling does this job use?',
        stacks(
          'Jest', 'Vitest', 'Mocha', 'Jasmine', 'Cypress', 'Playwright', 'Selenium', 'Puppeteer', 'WebdriverIO', 'Testing Library', 'Postman', 'JMeter', 'k6', 'Locust', 'JUnit', 'TestNG', 'Mockito', 'NUnit', 'xUnit', 'pytest', 'unittest', 'RSpec', 'PHPUnit', 'Cucumber', 'Appium', 'Detox', 'TDD', 'BDD', 'Unit tests', 'E2E tests', 'Load testing', 'QA automation', 'Pandas', 'NumPy', 'SciPy', 'scikit-learn', 'PyTorch', 'TensorFlow', 'Keras', 'Hugging Face', 'LangChain', 'LlamaIndex', 'OpenAI API', 'LLMs / generative AI', 'RAG', 'MLflow', 'Kubeflow', 'Jupyter', 'OpenCV', 'spaCy', 'NLP', 'Computer vision', 'Reinforcement learning', 'Tableau', 'Power BI', 'Looker', 'Excel', 'Android', 'iOS', 'React Native', 'Flutter', 'Xamarin/MAUI', 'Ionic', 'SwiftUI', 'Jetpack Compose', 'Electron', 'Tauri', 'Qt', 'WPF', 'Unity', 'Unreal Engine', 'Godot', 'Embedded/IoT', 'Arduino', 'Raspberry Pi', 'ROS', 'Blockchain', 'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence', 'Slack', 'Notion', 'Linear', 'Figma', 'Agile/Scrum', 'Kanban', 'Code review', 'Pair programming', 'Open source', 'Technical writing', 'Mentoring', 'WordPress', 'Shopify', 'Magento', 'Drupal', 'Salesforce', 'SAP', 'ServiceNow'
        )
      )
    ]
    return [gate, ...[...rest, ...tech].map((q) => ({...q, dependsOn}))]
  }
}
