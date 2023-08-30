import express from 'express'
import bodyParser from 'body-parser'
import router from './routes'

const app = express()
const port = process.env.PORT || 3000

app.use(bodyParser.json())
app.use('/todos', router)

// Global error handler
app.use((err, res) => {
  console.error(err)
  res.status(500).send('An internal server error occurred')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
