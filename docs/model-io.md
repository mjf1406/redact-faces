# Model inputs and outputs

## det_500m.onnx

- Pack: fast
- Bytes: 2524817
- SHA-256: 5e4447f50245bbd7966bd6c0fa52938c61474a04ec7def48753668a9d8b4ea3a

### Inputs

- `input.1` elem 1 shape [1, 3, ?, ?]

### Outputs

- `443` elem 1 shape [12800, 1]
- `468` elem 1 shape [3200, 1]
- `493` elem 1 shape [800, 1]
- `446` elem 1 shape [12800, 4]
- `471` elem 1 shape [3200, 4]
- `496` elem 1 shape [800, 4]
- `449` elem 1 shape [12800, 10]
- `474` elem 1 shape [3200, 10]
- `499` elem 1 shape [800, 10]

## w600k_mbf.onnx

- Pack: fast
- Bytes: 13616099
- SHA-256: 9cc6e4a75f0e2bf0b1aed94578f144d15175f357bdc05e815e5c4a02b319eb4f

### Inputs

- `input.1` elem 1 shape [None, 3, 112, 112]

### Outputs

- `516` elem 1 shape [1, 512]

## det_10g.onnx

- Pack: accurate
- Bytes: 16923827
- SHA-256: 5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91

### Inputs

- `input.1` elem 1 shape [1, 3, ?, ?]

### Outputs

- `448` elem 1 shape [12800, 1]
- `471` elem 1 shape [3200, 1]
- `494` elem 1 shape [800, 1]
- `451` elem 1 shape [12800, 4]
- `474` elem 1 shape [3200, 4]
- `497` elem 1 shape [800, 4]
- `454` elem 1 shape [12800, 10]
- `477` elem 1 shape [3200, 10]
- `500` elem 1 shape [800, 10]

## w600k_r50.onnx

- Pack: accurate
- Bytes: 174383860
- SHA-256: 4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43

### Inputs

- `input.1` elem 1 shape [None, 3, 112, 112]

### Outputs

- `683` elem 1 shape [1, 512]
