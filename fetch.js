import https from 'https';

const urls = [
  'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/national/supermarket_1_tracker_results.csv',
  'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/config/National%20CPI%20By%20Category.csv',
  'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/supermarket_1_daily_n_counts.csv'
];

urls.forEach(url => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('---', url);
      console.log(data.split('\n').slice(0, 5).join('\n'));
    });
  });
});
