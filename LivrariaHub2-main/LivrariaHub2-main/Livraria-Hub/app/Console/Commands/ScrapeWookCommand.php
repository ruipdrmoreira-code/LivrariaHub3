<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class ScrapeWookCommand extends Command
{
    protected $signature = 'wook:scrape';

    protected $description = 'Executa o scraper Node (Puppeteer) da Wook e grava/atualiza livros na base de dados.';

    public function handle(): int
    {
        $connection = config('database.default');
        $cfg = config("database.connections.{$connection}");

        if (($cfg['driver'] ?? '') !== 'mysql') {
            $this->error('A conexão ativa da base de dados tem de ser MySQL (DB_CONNECTION=mysql) para o scraper.');

            return self::FAILURE;
        }

        $scraperDir = base_path('scraper');
        $script = $scraperDir.DIRECTORY_SEPARATOR.'index.js';

        if (! is_file($script)) {
            $this->error("Ficheiro em falta: {$script}");

            return self::FAILURE;
        }

        $env = array_merge($_ENV, [
            'DB_HOST' => (string) ($cfg['host'] ?? '127.0.0.1'),
            'DB_PORT' => (string) ($cfg['port'] ?? 3306),
            'DB_USER' => (string) ($cfg['username'] ?? 'root'),
            'DB_USERNAME' => (string) ($cfg['username'] ?? 'root'),
            'DB_PASSWORD' => (string) ($cfg['password'] ?? ''),
            'DB_NAME' => (string) ($cfg['database'] ?? ''),
            'DB_DATABASE' => (string) ($cfg['database'] ?? ''),
        ]);

        $this->info('A iniciar scraper (pode demorar vários minutos)...');

        $process = new Process(['node', 'index.js'], $scraperDir, $env, null, null);
        $process->setTimeout(null);
        $process->run(function ($type, $buffer) {
            $this->output->write($buffer);
        });

        if (! $process->isSuccessful()) {
            $this->newLine();
            $this->error('O scraper terminou com erro.');

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Scraper concluído.');

        return self::SUCCESS;
    }
}
