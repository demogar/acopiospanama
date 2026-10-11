// Los títulos de los PR siguen Conventional Commits: al fusionar con squash se convierten en el
// mensaje del commit, y release-please los usa para calcular la versión y escribir el CHANGELOG.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // El asunto va en español y puede empezar con mayúscula (p. ej. nombres propios o «Bump» de Dependabot).
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
