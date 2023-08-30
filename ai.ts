import { PineconeClient } from '@pinecone-database/pinecone'
import * as dotenv from 'dotenv'
import { VectorDBQAChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'
import { OpenAI } from 'langchain/llms/openai'
import { ApifyDatasetLoader } from 'langchain/document_loaders/web/apify_dataset'

dotenv.config()

const client = new PineconeClient()
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
})
const pineconeIndex = client.Index(process.env.PINECONE_INDEX)

export const indexEmbeddings = async (url: string) => {
  const loader = await ApifyDatasetLoader.fromActorCall(
    'apify/website-content-crawler',
    {
      startUrls: [
        {
          url,
        },
      ],
    },
    {
      datasetMappingFunction: (item) =>
        new Document({
          pageContent: (item.text || '') as string,
          metadata: { source: item.url },
        }),
      clientOptions: {
        token: process.env.APIFY_API_KEY,
      },
    }
  )

  const docs = await loader.load()

  return await PineconeStore.fromDocuments(
    docs,
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    {
      pineconeIndex,
    }
  )
}

export const loadEmbeddings = async () => {
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    { pineconeIndex }
  )

  const model = new OpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
  })
  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    k: 1,
    returnSourceDocuments: true,
    // metadata: { foo: 'bar' },
  })
  const response = await chain.call({ query: 'What is The Black Maria' })

  console.log(response.text)
  console.log(response.sourceDocuments.map((d: Document) => d.metadata))
}
