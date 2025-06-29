module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js'],
  testMatch: ['**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    '*.js',
    '!*.test.js',
    '!jest.*.js'
  ],
  coverageReporters: ['text', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/']
};
