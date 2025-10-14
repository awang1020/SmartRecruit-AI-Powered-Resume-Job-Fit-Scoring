export type SkillMatchStrength = 'strong' | 'needs-improvement' | 'weak';

export interface SkillAnalysisEntry {
  category: string;
  key: string;
  requiredScore: number;
  candidateScore: number;
  status: SkillMatchStrength;
  requiredKeywords: string[];
  candidateKeywords: string[];
}

interface KeywordStats {
  job: number;
  resume: number;
}

interface CategoryRule {
  theme: string;
  patterns: (string | RegExp)[];
  additionalKeywords?: string[];
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'with',
  'within',
  'via',
  'using',
  'leveraging',
  'utilizing',
  'experience',
  'experiences',
  'experienced',
  'skill',
  'skills',
  'skilled',
  'ability',
  'abilities',
  'knowledge',
  'capability',
  'capabilities',
  'proficiency',
  'proficiencies',
  'strong',
  'proven',
  'demonstrated',
  'working',
  'across',
  'including',
  'such',
  'well',
  'highly',
  'per',
  'each',
  'own',
  'new',
  'via',
  'through',
  'among'
]);

const CATEGORY_RULES: CategoryRule[] = [
  {
    theme: 'frontend',
    patterns: [/front[-\s]?end/, 'ui', 'ux', 'javascript', 'typescript', 'react', 'next.js', 'nextjs', 'vue', 'angular', 'css', 'html', 'tailwind'],
    additionalKeywords: ['responsive design', 'component']
  },
  {
    theme: 'backend',
    patterns: [/back[-\s]?end/, 'node', 'node.js', 'express', 'nestjs', 'spring', 'java', 'kotlin', 'python', 'django', 'flask', 'fastapi', 'graphql', 'rest'],
    additionalKeywords: ['microservices', 'api']
  },
  {
    theme: 'cloud',
    patterns: ['aws', 'azure', 'gcp', 'cloud', 'kubernetes', 'docker', 'container', 'serverless', 'lambda', 'terraform'],
    additionalKeywords: ['iac']
  },
  {
    theme: 'devops',
    patterns: ['devops', 'ci/cd', 'continuous integration', 'continuous delivery', 'jenkins', 'github actions', 'gitlab', 'sre', 'observability', 'monitoring'],
    additionalKeywords: ['automation']
  },
  {
    theme: 'data',
    patterns: ['data', 'sql', 'nosql', 'postgres', 'mysql', 'mongodb', 'bigquery', 'redshift', 'snowflake', 'powerbi', 'tableau', 'analytics', 'warehouse', 'pipeline'],
    additionalKeywords: ['business intelligence']
  },
  {
    theme: 'ai-ml',
    patterns: ['ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'llm', 'tensorflow', 'pytorch', 'scikit', 'hugging face', 'model'],
    additionalKeywords: ['prompt engineering']
  },
  {
    theme: 'security',
    patterns: ['security', 'iam', 'zero trust', 'owasp', 'vulnerability', 'compliance', 'penetration', 'threat'],
    additionalKeywords: ['governance']
  },
  {
    theme: 'project-management',
    patterns: ['scrum', 'agile', 'kanban', 'roadmap', 'stakeholder', 'planning', 'delivery', 'backlog'],
    additionalKeywords: ['project management']
  },
  {
    theme: 'communication',
    patterns: ['communication', 'present', 'presentation', 'facilitation', 'collaborate', 'collaboration', 'workshop'],
    additionalKeywords: ['documentation']
  },
  {
    theme: 'leadership',
    patterns: ['leadership', 'mentoring', 'coaching', 'management', 'lead', 'guidance', 'strategic'],
    additionalKeywords: ['stakeholder management']
  }
];

const MAX_DYNAMIC_CATEGORIES = 12;
const TOKEN_REGEX = /[a-zA-Z0-9][a-zA-Z0-9+.#/&-]*/g;

const determineStatus = (score: number): SkillMatchStrength => {
  if (score >= 80) {
    return 'strong';
  }
  if (score >= 40) {
    return 'needs-improvement';
  }
  return 'weak';
};

const normalizeToken = (token: string) => token.toLowerCase();

const formatKeyword = (keyword: string): string => {
  const cleaned = keyword.trim();
  if (!cleaned) {
    return '';
  }

  if (/^[a-z0-9+.#/&-]{1,4}$/i.test(cleaned.replace(/\s+/g, ''))) {
    return cleaned.toUpperCase();
  }

  return cleaned
    .split(/[\s/-]+/)
    .map((segment) => {
      if (!segment.trim()) {
        return segment;
      }
      if (segment.length <= 3 && segment === segment.toLowerCase()) {
        return segment.toUpperCase();
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(' ');
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
    
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const matches = text.toLowerCase().match(TOKEN_REGEX);
  if (!matches) {
    return tokens;
  }
  for (const raw of matches) {
    const token = normalizeToken(raw);
    if (!token || STOPWORDS.has(token)) {
      continue;
    }
    if (/^\d+$/.test(token)) {
      continue;
    }
    tokens.push(token);
  }
  return tokens;
}

function buildKeywordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const tokens = tokenize(text);

  const increment = (key: string) => {
    const previous = counts.get(key) ?? 0;
    counts.set(key, previous + 1);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    increment(token);

    if (i < tokens.length - 1) {
      const next = tokens[i + 1];
      if (!STOPWORDS.has(next)) {
        increment(`${token} ${next}`);
      }
    }

    if (i < tokens.length - 2) {
      const next = tokens[i + 1];
      const third = tokens[i + 2];
      if (!STOPWORDS.has(next) && !STOPWORDS.has(third)) {
        increment(`${token} ${next} ${third}`);
      }
    }
  }

  return counts;
}

function mergeKeywordStats(
  resumeCounts: Map<string, number>,
  jobCounts: Map<string, number>
): Map<string, KeywordStats> {
  const merged = new Map<string, KeywordStats>();
  const allKeys = new Set<string>([...resumeCounts.keys(), ...jobCounts.keys()]);
  allKeys.forEach((key) => {
    merged.set(key, {
      resume: resumeCounts.get(key) ?? 0,
      job: jobCounts.get(key) ?? 0
    });
  });
  return merged;
}

function matchCategoryRule(keyword: string, rule: CategoryRule): boolean {
  return rule.patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return keyword.includes(pattern.toLowerCase());
    }
    return pattern.test(keyword);
  });
}

function deriveCategories(
  resumeCounts: Map<string, number>,
  jobCounts: Map<string, number>
): {
  key: string;
  label: string;
  keywords: string[];
}[] {
  const merged = mergeKeywordStats(resumeCounts, jobCounts);
  const categories: { key: string; label: string; keywords: string[] }[] = [];
  const usedKeywords = new Set<string>();
  const usedKeys = new Set<string>();

  const buildKey = (value: string, fallback: string) => {
    const base = slugify(value) || slugify(fallback) || 'category';
    let candidate = base;
    let counter = 1;
    while (usedKeys.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    usedKeys.add(candidate);
    return candidate;
  };

  CATEGORY_RULES.forEach((rule) => {
    const matchingKeywords = Array.from(merged.entries())
      .filter(([keyword, stats]) => {
        if (usedKeywords.has(keyword)) {
          return false;
        }
        const total = stats.job + stats.resume;
        if (total === 0) {
          return false;
        }
        if (matchCategoryRule(keyword, rule)) {
          return true;
        }
        if (rule.additionalKeywords) {
          return rule.additionalKeywords.some((value) => keyword.includes(value));
        }
        return false;
      })
      .map(([keyword, stats]) => ({ keyword, total: stats.job + stats.resume }))
      .sort((a, b) => b.total - a.total)
      .map(({ keyword }) => keyword);

    if (!matchingKeywords.length) {
      return;
    }

    const unique = matchingKeywords.slice(0, 12);
    unique.forEach((keyword) => usedKeywords.add(keyword));

    categories.push({
      key: buildKey(rule.theme, rule.theme),
      label: formatKeyword(rule.theme.replace(/-/g, ' ')),
      keywords: unique
    });
  });

  const remainingKeywords = Array.from(merged.entries())
    .filter(([keyword, stats]) => {
      if (usedKeywords.has(keyword)) {
        return false;
      }
      const total = stats.job + stats.resume;
      if (total === 0) {
        return false;
      }
      if (keyword.length < 3) {
        return false;
      }
      return true;
    })
    .map(([keyword, stats]) => ({ keyword, total: stats.job + stats.resume }))
    .sort((a, b) => b.total - a.total);

  for (const entry of remainingKeywords) {
    if (categories.length >= MAX_DYNAMIC_CATEGORIES) {
      break;
    }
    usedKeywords.add(entry.keyword);
    categories.push({
      key: buildKey(entry.keyword, `dynamic-${categories.length}`),
      label: formatKeyword(entry.keyword),
      keywords: [entry.keyword]
    });
  }

  return categories;
}

function limitKeywords(keywords: string[], limit = 6): string[] {
  return keywords
    .map((keyword) => formatKeyword(keyword))
    .filter((value) => value.length > 0)
    .slice(0, limit);
}

export function analyzeSkills(
  resumeText: string,
  jobDescriptionText: string
): SkillAnalysisEntry[] {
  const resumeCounts = buildKeywordCounts(resumeText);
  const jobCounts = buildKeywordCounts(jobDescriptionText);
  const merged = mergeKeywordStats(resumeCounts, jobCounts);

  const categories = deriveCategories(resumeCounts, jobCounts);

  const categoryStats = categories.map((category) => {
    const stats = category.keywords.map((keyword) => merged.get(keyword) ?? { job: 0, resume: 0 });
    const jobIntensity = stats.reduce((sum, item) => sum + item.job, 0);
    const resumeIntensity = stats.reduce((sum, item) => sum + item.resume, 0);

    return {
      ...category,
      jobIntensity,
      resumeIntensity,
      jobKeywords: category.keywords.filter((keyword) => (merged.get(keyword)?.job ?? 0) > 0),
      resumeKeywords: category.keywords.filter((keyword) => (merged.get(keyword)?.resume ?? 0) > 0)
    };
  });

  const maxJobIntensity = Math.max(1, ...categoryStats.map((category) => category.jobIntensity));
  const medianResumeIntensity = (() => {
    const intensities = categoryStats
      .map((category) => category.resumeIntensity)
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    if (!intensities.length) {
      return 1;
    }
    const middle = Math.floor(intensities.length / 2);
    if (intensities.length % 2 === 0) {
      return Math.max(1, Math.round((intensities[middle - 1] + intensities[middle]) / 2));
    }
    return Math.max(1, intensities[middle]);
  })();

  const entries: SkillAnalysisEntry[] = categoryStats
    .map((category) => {
      const requiredScore = category.jobIntensity
        ? Math.round((Math.min(category.jobIntensity, maxJobIntensity) / maxJobIntensity) * 100)
        : 0;

      let candidateScore = 0;
      if (category.jobIntensity > 0) {
        candidateScore = Math.round(
          Math.min(1, category.resumeIntensity / category.jobIntensity || 0) * 100
        );
      } else if (category.resumeIntensity > 0) {
        candidateScore = Math.round(
          Math.min(1, category.resumeIntensity / medianResumeIntensity) * 100
        );
      }

      const requiredKeywords = limitKeywords(category.jobKeywords);
      const candidateKeywords = limitKeywords(category.resumeKeywords);

      return {
        category: category.label,
        key: category.key,
        requiredScore,
        candidateScore,
        status: determineStatus(candidateScore),
        requiredKeywords,
        candidateKeywords
      };
    })
    .filter((entry) => entry.requiredKeywords.length > 0 || entry.candidateKeywords.length > 0)
    .sort((a, b) => b.requiredScore - a.requiredScore || b.candidateScore - a.candidateScore);

  return entries;
}
