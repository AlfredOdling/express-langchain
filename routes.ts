import { Router, Request, Response } from 'express'
import { indexEmbeddings } from './ai'

const router = Router()
const todos: any[] = []

// Create
router.post('/', async (req: Request, res: Response) => {
  const { id, task } = req.body

  try {
    const res_ = await indexEmbeddings(
      'http://books.toscrape.com/catalogue/sapiens-a-brief-history-of-humankind_996/index.html'
    )

    if (res_) {
      res.status(200).json({ message: 'done' })
    }
  } catch (error) {
    console.error('🚨 error:', error)
    res.status(500).json({ message: 'An internal server error occurred' })
  }
})

// Read
router.get('/', (req: Request, res: Response) => {
  try {
    res.status(200).json({ data: 2 })
  } catch (error) {
    res.status(500).json({ message: 'An internal server error occurred' })
  }
})

// Update
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    const todo = todos.find((t) => t.id === id)

    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' })
    }

    const { task } = req.body

    if (task) {
      todo.task = task
    } else {
      return res
        .status(400)
        .json({ message: 'Task field is required for updating' })
    }

    res.status(200).json(todo)
  } catch (error) {
    res.status(500).json({ message: 'An internal server error occurred' })
  }
})

// Delete
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    const index = todos.findIndex((t) => t.id === id)
    if (index > -1) {
      todos.splice(index, 1)
      res.status(204).send()
    } else {
      res.status(404).json({ message: 'Todo not found' })
    }
  } catch (error) {
    res.status(500).json({ message: 'An internal server error occurred' })
  }
})

export default router
