const _ = require('lodash');
const axios = require("axios");
const cheerio = require("cheerio");
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');

const enforceHttpsUrl = url =>
	_.isString(url) ? url.replace(/^(https?:)?\/\//, "https://") : null;

const fetchHtmlFromUrl = async url => {
	return await axios
		.get(enforceHttpsUrl(url))
		.then(response => cheerio.load(response.data))
		.catch(error => {
			error.status = (error.response && error.response.status) || 500;
			throw error;
		});
};

const fetchElemInnerText = elem => (elem.text && elem.text().trim()) || null;

const generateCsv = async () => {
  const dicc = await getDicc();
  Object.keys(dicc).map(async l => {
    const savedDicc = await readCsv(l);
    saveCsv(l, [...savedDicc, ...dicc[l]])
  });
}

const getDicc = async () => {
  const words = await getWords();
  const pp = await Promise.all(
    words.map(async word => {
      const letter = getLetter(word);
      const definition = await getRAEDef(word);
      return {
        letter,
        word,
        definition
      }
    })
  );
  const dicc = pp
    .filter(p => Boolean(p.definition))
    .reduce(
      (prev, curr) => ({
        ...prev,
        [curr.letter]: [
          ...(prev[curr.letter] ? prev[curr.letter] : []),
          { word: curr.word, definition: curr.definition}
        ]
      }), {}
    );

  return dicc;
}

const getLetter = ( word ) => {
  const w = word.toUpperCase();
  if (w.includes('Ñ')) {
    return 'Ñ';
  } else if (w.includes('H') && Math.random() > 0.5) {
    return 'H'
  } else if (w.includes('U') && Math.random() > 0.5) {
    return 'U'
  } else if (w.includes('X') && Math.random() > 0.5) {
    return 'X'
  } else if (w.includes('Y') && Math.random() > 0.5) {
    return 'Y'
  } else if (w.includes('Z') && Math.random() > 0.5) {
    return 'Z'
  }
  return w.substr(0,1);
}

const getWords = async (count = 10) => {
  const $ = await fetchHtmlFromUrl(`https://www.palabrasaleatorias.com/?fs=${count}&Submit=Nueva+palabra`);
  const pal = $('div[style="font-size:3em; color:#6200C5;"]');
  const words = fetchElemInnerText(pal).split('\n')
  return words;
  
}

const getRAEDef = async ( word ) => {
  const $ = await fetchHtmlFromUrl(`https://dle.rae.es/${word}`);
  const def = fetchElemInnerText($('.j').first().find('mark').append(' '));
  return (def)
} 

const saveCsv = (letter, data) => {
  const csvWriter = createObjectCsvWriter({
    path: `dicc/${letter}.csv`,
    header: ['word', 'definition']
  });
  return csvWriter
    .writeRecords(data)
    .then(()=> console.log(`Saved ${letter} CSV`));
}

const readCsv = async (letter) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const path = `dicc/${letter}.csv`;
    if (!fs.existsSync(path)) {
      resolve(results);
      return;
    }
    const parser = fs.createReadStream(path)
      .pipe(csv(['word', 'definition']))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(results);
        resolve(results);
      });
    });
}

const timeout = (millis) =>
  new Promise((resolve, reject) => setTimeout(resolve, millis));

const main = async () => {
  console.log(`Started to scrap`)
  for (let i = 0; i < 1; i++) { 
    console.log('Round', i);
    try {
      await generateCsv();
      await timeout(10000);
    } catch (e) {
      console.error(e)
    }
  }
  return;
}

main();

