export const SKILL_SYNONYMS: Record<string, string> = {
  reactjs: 'react',
  'react.js': 'react',
  reactnative: 'react native',
  'react-native': 'react native',
  nextjs: 'next.js',
  next: 'next.js',
  vuejs: 'vue',
  'vue.js': 'vue',
  nuxtjs: 'nuxt',
  angularjs: 'angular',
  sveltekit: 'sveltekit',
  ts: 'typescript',
  js: 'javascript',
  nodejs: 'node.js',
  node: 'node.js',
  'node js': 'node.js',
  expressjs: 'express',
  nestjs: 'nest.js',
  nest: 'nest.js',
  postgres: 'postgresql',
  psql: 'postgresql',
  mongo: 'mongodb',
  'mongo db': 'mongodb',
  rediscache: 'redis',
  k8s: 'kubernetes',
  gcp: 'google cloud',
  aws: 'aws',
  azure: 'azure',
  html5: 'html',
  css3: 'css',
  tailwindcss: 'tailwind css',
  tailwind: 'tailwind css',
  shadcn: 'shadcn/ui',
  'shadcn ui': 'shadcn/ui',
  mui: 'material ui',
  'material-ui': 'material ui',
  graphql: 'graphql',
  gql: 'graphql',
  restapi: 'rest',
  'rest api': 'rest',
  ci: 'ci/cd',
  cd: 'ci/cd',
  'github actions': 'github actions',
  ghactions: 'github actions',
  dockercompose: 'docker',
  pytest: 'python',
  golang: 'go',
  csharp: 'c#',
  cpp: 'c++',
  'c plus plus': 'c++',
  dotnet: '.net',
  'dot net': '.net',
  rails: 'ruby on rails',
  ror: 'ruby on rails',
  fastify: 'fastify',
  express: 'express',
  prismaorm: 'prisma',
  typeorm: 'typeorm',
  sequelize: 'sequelize',
  reduxtoolkit: 'redux',
  rtk: 'redux',
  zustand: 'zustand',
  jotai: 'jotai',
  webpack: 'webpack',
  vitejs: 'vite',
  esbuild: 'esbuild',
  playwright: 'playwright',
  cypressio: 'cypress',
  jestjs: 'jest',
  vitest: 'vitest',
  storybook: 'storybook',
  figma: 'figma',
  jira: 'jira',
  linux: 'linux',
  git: 'git',
  github: 'github',
  gitlab: 'gitlab',
  bitbucket: 'bitbucket',
  openai: 'openai',
  llm: 'llms',
  langchain: 'langchain',
  ollama: 'ollama',
};

export const CANONICAL_SKILLS = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C#',
  'C++',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Scala',
  'React',
  'React Native',
  'Next.js',
  'Vue',
  'Nuxt',
  'Angular',
  'Svelte',
  'SvelteKit',
  'SolidJS',
  'Node.js',
  'Express',
  'Fastify',
  'Nest.js',
  'Django',
  'Flask',
  'FastAPI',
  'Spring',
  'Ruby on Rails',
  '.NET',
  'HTML',
  'CSS',
  'Sass',
  'Tailwind CSS',
  'shadcn/ui',
  'Material UI',
  'GraphQL',
  'REST',
  'gRPC',
  'tRPC',
  'PostgreSQL',
  'MySQL',
  'SQLite',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'Prisma',
  'TypeORM',
  'Sequelize',
  'Drizzle',
  'AWS',
  'Azure',
  'Google Cloud',
  'Docker',
  'Kubernetes',
  'Terraform',
  'CI/CD',
  'GitHub Actions',
  'GitLab CI',
  'Linux',
  'Git',
  'GitHub',
  'GitLab',
  'Redux',
  'Zustand',
  'Jotai',
  'React Query',
  'TanStack Query',
  'Webpack',
  'Vite',
  'esbuild',
  'Playwright',
  'Cypress',
  'Jest',
  'Vitest',
  'Testing Library',
  'Storybook',
  'Figma',
  'Jira',
  'OpenAI',
  'LLMs',
  'LangChain',
  'Ollama',
  'Prompt Engineering',
  'WebSockets',
  'OAuth',
  'JWT',
  'S3',
  'Cloudflare',
  'Vercel',
  'Nginx',
  'Kafka',
  'RabbitMQ',
  'Elasticsearch',
  'Datadog',
  'Sentry',
  'Accessibility',
  'WCAG',
  'SEO',
  'RxJS',
  'D3',
  'Three.js',
  'WebGL',
  'Electron',
  'Tauri',
  'Flutter',
  'Dart',
  'SwiftUI',
  'UIKit',
  'Android',
  'iOS',
  'SQL',
  'NoSQL',
  'Microservices',
  'System Design',
  'Agile',
  'Scrum',
] as const;

const slugToCanonical = new Map<string, string>();
for (const name of CANONICAL_SKILLS) {
  slugToCanonical.set(slugifySkill(name), name);
}

export function slugifySkill(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9.+#]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeSkillName(raw: string): string {
  const slug = slugifySkill(raw);
  if (!slug) return raw.trim();
  const synonym = SKILL_SYNONYMS[slug] ?? SKILL_SYNONYMS[slug.replace(/\s/g, '')];
  const resolved = synonym ?? slug;
  return slugToCanonical.get(resolved) ?? titleCaseSkill(resolved);
}

export function titleCaseSkill(value: string): string {
  const known = slugToCanonical.get(value);
  if (known) return known;
  return value
    .split(' ')
    .map((part) => {
      if (['css', 'html', 'sql', 'aws', 'api', 'ci', 'cd', 'ui', 'ux'].includes(part)) {
        return part.toUpperCase();
      }
      if (part === 'js') return 'JS';
      if (part === 'ts') return 'TS';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const name of CANONICAL_SKILLS) {
    const slug = slugifySkill(name);
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(slug)}(?:$|[^a-z0-9])`, 'i');
    if (pattern.test(lower)) {
      found.add(name);
    }
  }

  for (const [alias, canonical] of Object.entries(SKILL_SYNONYMS)) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(alias)}(?:$|[^a-z0-9])`, 'i');
    if (pattern.test(lower)) {
      found.add(normalizeSkillName(canonical));
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
