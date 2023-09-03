import { Router, Request, Response } from 'express'
import { loadEmbeddingsAndQuestion, scrapeAndIndexEmbeddings } from './ai'

const router = Router()

router.post('/scrapeAndIndex', async (req: Request, res: Response) => {
  const { url, type, userEmail } = req.body
  console.log('🚀  req.body:', req.body)

  try {
    const sourceId = await scrapeAndIndexEmbeddings(url, type, userEmail)
    res.status(200).json({ sourceId })
  } catch (error) {
    res.status(500).json({ message: error })
  }
})

router.post('/chat', async (req: Request, res: Response) => {
  const { sourceIds, query } = req.body

  try {
    const res_ = await loadEmbeddingsAndQuestion(sourceIds, query)
    res.status(200).json({ res: res_ })
  } catch (error) {
    res.status(500).json({ message: error })
  }
})

export default router
