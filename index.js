
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

console.log(__dirname);

app.use('/jsfiles',express.static(__dirname + '/jsfiles'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
