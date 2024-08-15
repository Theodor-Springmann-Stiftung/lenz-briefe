module.exports = {
  plugins: [
    require('tailwindcss'),
    // Production:
    require('autoprefixer'),
    require('cssnano')({ preset: 'default' })
  ],
}
