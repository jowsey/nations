namespace Map
{
    public enum CellBiome : byte
    {
        Grass = 0,
        Forest = 1,
        Water = 2,
        Beach = 3,
        Mountain = 4
    }

    public struct MapCell
    {
        // 2 byte bitfield, see HexCell type in server
        public ushort Details;

        // Highest 4 bits
        public CellBiome Biome => (CellBiome)(Details >> 12);

        // Second-highest 4 bits - these vary per biome so no enum here
        public byte Cosmetic => (byte)((Details >> 8) & 0x0F);
    }
}