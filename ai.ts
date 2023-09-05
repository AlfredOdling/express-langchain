import { PineconeClient } from '@pinecone-database/pinecone'
import * as dotenv from 'dotenv'
import { RetrievalQAChain, loadQAStuffChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'
import { OpenAI } from 'langchain/llms/openai'
import { ApifyDatasetLoader } from 'langchain/document_loaders/web/apify_dataset'
import { GraphQLClient, gql } from 'graphql-request'
import { promptTemplate } from './promtTemplate'
import { PromptTemplate } from 'langchain/prompts'

dotenv.config()

const client = new PineconeClient()
await client.init({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
})
const pineconeIndex = client.Index(process.env.PINECONE_INDEX)

const client8Base = new GraphQLClient(
  process.env.REACT_APP_8BASE_API_ENDPOINT,
  {
    headers: {
      authorization: `Bearer ${process.env.REACT_APP_8BASE_TOKEN}`,
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
      saveScreenshots: false,
      startUrls: [
        {
          url,
          userData: {
            sourceId,
            userEmail,
          },
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
  const prompt = PromptTemplate.fromTemplate(promptTemplate)

  const model = new OpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  const chain = new RetrievalQAChain({
    retriever: vectorStore.asRetriever(),
    combineDocumentsChain: loadQAStuffChain(model, { prompt }),
    returnSourceDocuments: true,
  })

  const response = await chain.call({
    query,
  })

  return {
    text: response.text,
    sourceDocuments: response.sourceDocuments,
    role: 'ai',
  }
}
