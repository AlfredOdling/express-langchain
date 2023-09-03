import { PineconeClient } from '@pinecone-database/pinecone'
import * as dotenv from 'dotenv'
import { VectorDBQAChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'
import { OpenAI } from 'langchain/llms/openai'
import { ApifyDatasetLoader } from 'langchain/document_loaders/web/apify_dataset'
import { GraphQLClient, gql } from 'graphql-request'

dotenv.config()

const client = new PineconeClient()
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
})
const pineconeIndex = client.Index(process.env.PINECONE_INDEX)

const client8Base = new GraphQLClient(
  'https://uk.api.8base.com/cl1bujdae06nb09mhasqg4we4',
  {
    headers: {
      authorization: `Bearer ${'6efa64ce-8c8c-432e-b54f-a80dc6e2dd08'}`,
      //environment: Env.EIGHTBASE_ENVIRONMENT,
    },
  }
)

const createSource = async (url: string, userEmail: string) => {
  const res = await client8Base.request(
    gql`
      mutation SourceCreate($data: SourceCreateInput!) {
        sourceCreate(data: $data) {
          id
        }
      }
    `,
    {
      data: {
        url,
        user: {
          connect: {
            email: userEmail,
          },
        },
      },
    }
  )

  return res
}

const updateSource = async (sourceId: string) => {
  await client8Base.request(
    gql`
      mutation SourceUpdate($data: SourceUpdateInput!) {
        sourceUpdate(data: $data) {
          id
        }
      }
    `,
    {
      data: {
        id: sourceId,
        done: true,
      },
    }
  )
}

export const scrapeAndIndexEmbeddings = async (
  url: string,
  type: string,
  userEmail: string
) => {
  const res = await createSource(url, userEmail)
  const sourceId = await (res as any).sourceCreate.id

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
      datasetMappingFunction: (item) => {
        return new Document({
          pageContent: (item.text || '') as string,
          metadata: { source: item.url, sourceId },
        })
      },
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
  ).then(async () => await updateSource(sourceId))
}

export const loadEmbeddingsAndQuestion = async (
  sourceIds: string[],
  query: string
) => {
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    {
      pineconeIndex,
      filter: {
        sourceId: {
          $in: sourceIds,
        },
      },
    }
  )

  const model = new OpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    k: 1,
    returnSourceDocuments: true,
  })

  const response = await chain.call({ query })
  return response
}
