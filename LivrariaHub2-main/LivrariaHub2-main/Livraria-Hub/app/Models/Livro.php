<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Livro extends Model
{
    use SoftDeletes;

    protected $table = 'livros';

    protected $fillable = [
        'editora',
        'disciplina',
        'ano_escolar',
        'tipo',
        'titulo',
        'isbn',
        'codigo_interno',
        'preco',
        'ativo',
    ];

    protected function casts(): array
    {
        return [
            'ano_escolar' => 'integer',
            'preco' => 'decimal:2',
            'ativo' => 'boolean',
        ];
    }
}
