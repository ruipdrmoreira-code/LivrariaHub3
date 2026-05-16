<?php

namespace App\Http\Controllers;

use App\Models\Livro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LivroController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 5000), 1), 20000);
        $offset = max((int) $request->query('offset', 0), 0);
        $q = trim((string) $request->query('q', ''));
        $tipo = trim((string) $request->query('tipo', ''));
        $editora = trim((string) $request->query('editora', ''));
        $disciplina = trim((string) $request->query('disciplina', ''));
        $anoEscolar = $request->query('ano_escolar');

        try {
            $query = Livro::query()
                ->select([
                    'id',
                    'titulo',
                    'editora',
                    'disciplina',
                    'ano_escolar',
                    'tipo',
                    'isbn',
                    'codigo_interno',
                    'preco',
                    'ativo',
                    'updated_at',
                ])
                ->orderByDesc('updated_at')
                ->orderByDesc('id');

            if ($q !== '') {
                $like = '%'.$q.'%';
                $query->where(function ($w) use ($like) {
                    $w->where('titulo', 'like', $like)
                        ->orWhere('editora', 'like', $like)
                        ->orWhere('isbn', 'like', $like);
                });
            }

            if ($tipo !== '') {
                $query->whereRaw('UPPER(TRIM(COALESCE(tipo, ""))) = ?', [Str::upper($tipo)]);
            }

            if ($editora !== '') {
                $query->where('editora', $editora);
            }

            if ($disciplina !== '') {
                $query->where('disciplina', $disciplina);
            }

            if ($anoEscolar !== null && $anoEscolar !== '' && is_numeric($anoEscolar)) {
                $query->where('ano_escolar', (int) $anoEscolar);
            }

            $total = (clone $query)->count();
            $livros = $query->offset($offset)->limit($limit)->get();

            $tipos = Livro::query()
                ->whereNotNull('tipo')
                ->where('tipo', '<>', '')
                ->distinct()
                ->orderBy('tipo')
                ->pluck('tipo')
                ->map(fn ($t) => Str::upper(trim((string) $t)))
                ->unique()
                ->sort()
                ->values()
                ->all();

            $editorasRaw = Livro::query()
                ->whereNotNull('editora')
                ->where('editora', '<>', '')
                ->where('editora', '<>', '-')
                ->whereRaw('LOWER(TRIM(editora)) NOT IN (?, ?)', ['desconhecida', 'desconhecido'])
                ->distinct()
                ->orderBy('editora')
                ->limit(800)
                ->pluck('editora')
                ->values();

            $editoras = $editorasRaw
                ->map(function ($e) {
                    $v = trim((string) $e);
                    $compact = preg_replace('/\s+/u', ' ', $v) ?: $v;

                    return [
                        'valor' => $v,
                        'etiqueta' => Str::limit($compact, 44, '…'),
                    ];
                })
                ->unique('valor')
                ->sortBy('etiqueta')
                ->values()
                ->all();

            $disciplinas = Livro::query()
                ->whereNotNull('disciplina')
                ->where('disciplina', '<>', '')
                ->distinct()
                ->orderBy('disciplina')
                ->limit(200)
                ->pluck('disciplina')
                ->map(function ($d) {
                    $v = trim((string) $d);

                    return [
                        'valor' => $v,
                        'etiqueta' => Str::limit(preg_replace('/\s+/u', ' ', $v) ?: $v, 40, '…'),
                    ];
                })
                ->unique('valor')
                ->values()
                ->all();

            $anos = Livro::query()
                ->whereNotNull('ano_escolar')
                ->where('ano_escolar', '>', 0)
                ->distinct()
                ->orderBy('ano_escolar')
                ->pluck('ano_escolar')
                ->values()
                ->all();

            return response()->json([
                'ok' => true,
                'filtros' => [
                    'q' => $q,
                    'tipo' => $tipo,
                    'editora' => $editora,
                    'disciplina' => $disciplina,
                    'ano_escolar' => $anoEscolar !== null && $anoEscolar !== '' ? (int) $anoEscolar : null,
                    'limit' => $limit,
                    'offset' => $offset,
                ],
                'tipos' => $tipos,
                'editoras' => $editoras,
                'disciplinas' => $disciplinas,
                'anos' => $anos,
                'total' => $total,
                'livros' => $livros,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'erro' => 'Falha ao ler dados da base de dados.',
                'detalhe' => $e->getMessage(),
            ], 500);
        }
    }
}
