module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Enforce explicit return types on functions
    '@typescript-eslint/explicit-function-return-type': 'warn',
    // No console.log in production (use a logger service)
    'no-console': ['warn', {allow: ['warn', 'error']}],
    // Consistent imports
    'import/order': 'warn',
  },
};
