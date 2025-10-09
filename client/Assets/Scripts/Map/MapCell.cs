namespace Map
{
    // See spec.md
    public enum CellBiome : byte
    {
        Grass = 0,
        Forest = 1,
        Water = 2,
        Beach = 3,
        Mountain = 4
    }

    public class MapCell
    {
        // Column
        public int Q;

        // Row
        public int R;

        // 2 byte bitfield, see spec.md
        public ushort Details;

        // Highest 4 bits
        public CellBiome Biome => (CellBiome)(Details >> 12);

        // Second-highest 4 bits - these vary per biome so no enum here
        public byte Cosmetic => (byte)((Details >> 8) & 0x0F);
    }
}