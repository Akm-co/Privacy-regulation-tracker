import 'dotenv/config';
import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

const feedsToTest = [
  { name: 'FPF', url: 'https://fpf.org/feed/' },
  { name: 'Data Protection Report', url: 'https://www.dataprotectionreport.com/feed/' },
  { name: 'CDT', url: 'https://cdt.org/feed/' },
  { name: 'TechCrunch Privacy', url: 'https://techcrunch.com/category/privacy/feed/' },
];

async function runTests() {
  for (const feed of feedsToTest) {
    console.log(`\n--- Testing ${feed.name} ---`);
    console.log(`URL: ${feed.url}`);

    try {
      const result = await parser.parseURL(feed.url);
      console.log(`Title: ${result.title}`);
      console.log(`Items: ${result.items?.length || 0}`);

      if (result.items?.length > 0) {
        console.log('Sample items:');
        result.items.slice(0, 2).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.title}`);
          console.log(`     Link: ${item.link}`);
          console.log(`     Date: ${item.pubDate}`);
        });
      }
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }
  }
}

runTests();
