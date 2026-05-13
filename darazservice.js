import axios from 'axios';
import * as cheerio from 'cheerio';

export const searchDaraz = async (keyword) => {
    try {
        const url = `https://www.daraz.com.np/catalog/?q=${encodeURIComponent(keyword)}`;
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        });

        const $ = cheerio.load(data);
        const products = [];

        // Finding the data hidden in Daraz's script tag
        const script = $('script').filter((i, el) => $(el).html().includes('window.pageData=')).html();
        if (script) {
            const jsonStr = script.split('window.pageData=').split(';</script>');
            const result = JSON.parse(jsonStr);
            const items = result.mods?.listItems || [];

            items.slice(0, 5).map(item => {
                products.push({
                    name: item.name,
                    price: item.priceShow,
                    link: "https:" + item.productUrl,
                    image: item.image
                });
            });
        }
        return products;
    } catch (error) {
        console.error("Scraping error:", error);
        return [];
    }
};

